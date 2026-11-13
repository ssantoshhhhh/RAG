import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

function renderForgotPasswordForm() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ForgotPasswordForm />
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates the email before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderForgotPasswordForm();

    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the development reset link after submitting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "If an account exists for that email, we've sent instructions.",
            reset_url: "http://localhost:3000/reset-password?token=abc123",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderForgotPasswordForm();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open reset link/i })).toHaveAttribute(
      "href",
      "http://localhost:3000/reset-password?token=abc123",
    );
  });
});