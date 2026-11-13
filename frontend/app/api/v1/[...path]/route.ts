import { NextRequest } from "next/server";

import { isMailerConfigured, sendPasswordResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const FORGOT_PASSWORD_PATH = "auth/forgot-password";

const REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "x-csrf-token",
];

const RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-encoding",
  "content-type",
  "etag",
  "last-modified",
];

async function respondToForgotPassword(
  upstream: Response,
  recipient: string | null,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });
  }

  let payload: { message?: string; reset_url?: string | null };
  try {
    payload = (await upstream.json()) as typeof payload;
  } catch {
    return Response.json(
      { detail: "The DocuMind backend returned an unexpected response." },
      { status: 502 },
    );
  }

  if (payload.reset_url && recipient) {
    if (isMailerConfigured()) {
      try {
        const configured = Number(process.env.PASSWORD_RESET_EXPIRE_MINUTES ?? "30");
        await sendPasswordResetEmail({
          to: recipient,
          resetUrl: payload.reset_url,
          expiresMinutes:
            Number.isFinite(configured) && configured > 0 ? configured : 30,
        });
        payload.reset_url = null;
      } catch (error) {
        console.error("Failed to send password reset email", error);
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("Password reset email not sent: SMTP is not configured");
    }
  }

  if (process.env.NODE_ENV === "production") {
    payload.reset_url = null;
  }

  return Response.json(payload, { status: upstream.status });
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const pathName = path.join("/");
  const target = new URL(
    `${BACKEND_URL}/api/v1/${path.map(encodeURIComponent).join("/")}`,
  );
  target.search = request.nextUrl.search;

  const method = request.method.toUpperCase();
  const isForgotPassword = method === "POST" && pathName === FORGOT_PASSWORD_PATH;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (internalKey) headers.set("x-internal-key", internalKey);

  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  let recipient: string | null = null;
  if (isForgotPassword && body) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { email?: unknown };
      if (typeof parsed.email === "string") {
        recipient = parsed.email.trim().toLowerCase();
      }
    } catch {
      // Invalid JSON is reported by the backend.
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { detail: "The DocuMind backend is unavailable. Please try again shortly." },
      { status: 502 },
    );
  }

  if (isForgotPassword) {
    return respondToForgotPassword(upstream, recipient);
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const contentLength = upstream.headers.get("content-length");
  if (contentLength && !upstream.headers.get("content-encoding")) {
    responseHeaders.set("content-length", contentLength);
  }
  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD };