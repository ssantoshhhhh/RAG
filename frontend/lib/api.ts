import type { DocumentItem } from "@/lib/types";

const API_BASE = "/api/v1";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("dm_csrf="));
  return match ? decodeURIComponent(match.slice("dm_csrf=".length)) : null;
}

function extractDetail(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload || fallback;
  if (typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}

async function parseResponseError(response: Response): Promise<ApiError> {
  let message = response.statusText || "Request failed";
  try {
    const payload = await response.json();
    message = extractDetail(payload, message);
  } catch {
    // non-JSON error body
  }
  return new ApiError(message, response.status);
}

export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuthRefresh?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
  alreadyRetried = false,
): Promise<T> {
  const { body, skipAuthRefresh, headers, ...rest } = options;
  const method = (rest.method ?? "GET").toUpperCase();
  const requestHeaders = new Headers(headers);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) requestHeaders.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      method,
      headers: requestHeaders,
      body: requestBody,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection.", 0);
  }

  if (response.status === 401 && !alreadyRetried && !skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (!response.ok) {
    throw await parseResponseError(response);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export const api = {
  get<T>(path: string) {
    return apiFetch<T>(path);
  },
  post<T>(path: string, body?: unknown, skipAuthRefresh = false) {
    return apiFetch<T>(path, { method: "POST", body, skipAuthRefresh });
  },
  patch<T>(path: string, body?: unknown) {
    return apiFetch<T>(path, { method: "PATCH", body });
  },
  delete<T = void>(path: string) {
    return apiFetch<T>(path, { method: "DELETE" });
  },
};

export function uploadDocumentFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<DocumentItem[]> {
  const send = (retried: boolean): Promise<DocumentItem[]> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/documents/upload`);
      xhr.withCredentials = true;
      const csrf = getCsrfToken();
      if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onerror = () => reject(new ApiError("Upload failed. Please try again.", 0));

      xhr.onload = async () => {
        if (xhr.status === 401 && !retried) {
          const refreshed = await refreshSession();
          if (refreshed) {
            try {
              resolve(await send(true));
            } catch (error) {
              reject(error);
            }
            return;
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as DocumentItem[]);
          } catch {
            reject(new ApiError("Unexpected response from the server.", xhr.status));
          }
          return;
        }

        let message = `Upload failed (${xhr.status})`;
        try {
          const payload = JSON.parse(xhr.responseText);
          message = extractDetail(payload, message);
        } catch {
          // ignore malformed body
        }
        reject(new ApiError(message, xhr.status));
      };

      const formData = new FormData();
      formData.append("files", file, file.name);
      xhr.send(formData);
    });

  return send(false);
}