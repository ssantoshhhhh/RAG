import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

const replaceMock = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

function renderResetPasswordForm() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ResetPasswordForm />
    </QueryClientProvider>,
  );
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParams.delete("token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for a new link when the token is missing", () => {
    renderResetPasswordForm();
    expect(screen.getByText("Invalid reset link")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("requires matching passwords", async () => {
    searchParams.set("token", "abc123token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.type(screen.getByLabelText("New password"), "BrandNew123");
    await user.type(screen.getByLabelText("Confirm new password"), "Different123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to sign in after a successful reset", async () => {
    searchParams.set("token", "abc123token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.type(screen.getByLabelText("New password"), "BrandNew123");
    await user.type(screen.getByLabelText("Confirm new password"), "BrandNew123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });
});