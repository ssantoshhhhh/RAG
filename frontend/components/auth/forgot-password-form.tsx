"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { AuthError } from "@/components/auth/auth-error";
import { FieldError } from "@/components/auth/field-error";
import {
  authButton,
  authCard,
  authIcon,
  authInput,
  authLabel,
  authMicro,
  AuthBadge,
  AuthMeta,
  AuthStatusStrip,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useForgotPassword } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation";

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values);
    } catch {
      // error is rendered from the mutation state
    }
  });

  const errorMessage =
    forgot.error instanceof ApiError
      ? forgot.error.message
      : forgot.error
        ? "Unable to send reset instructions. Please try again."
        : null;

  if (forgot.isSuccess) {
    return (
      <div className={cn(authCard, "shadow-[6px_6px_0_rgba(17,17,17,0.05)]")}>
        <AuthMeta label="Transmission [Sec_auth]" right="Status: Sent" />

        <span className="mb-4 flex h-10 w-10 items-center justify-center bg-neutral-950 text-white">
          <CheckCircle2 className="h-5 w-5" />
        </span>

        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Check your email
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{forgot.data.message}</p>

        {forgot.data.reset_url ? (
          <div className="mt-5 space-y-2 border border-dashed border-[#d91e4a] bg-[#fff1f4] p-4">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d91e4a]">
              Development mode
            </p>
            <p className="text-xs leading-5 text-neutral-700">
              Email delivery is not configured, so use this link directly:
            </p>
            <Link
              href={forgot.data.reset_url}
              className="block break-all font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a31136] hover:underline"
            >
              Open reset link
            </Link>
          </div>
        ) : null}

        <Button
          asChild
          variant="outline"
          className="mt-6 h-12 w-full justify-between rounded-none border border-neutral-950 bg-white px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-950 shadow-none hover:bg-[#f0eef9]"
        >
          <Link href="/login">
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </span>
          </Link>
        </Button>

        <AuthStatusStrip left="Delivery: Secured" right="Expires: 30 min" />
      </div>
    );
  }

  return (
    <div className={cn(authCard, "shadow-[6px_6px_0_rgba(17,17,17,0.05)]")}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/login"
          className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-950"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
        <AuthBadge>Recovery</AuthBadge>
      </div>

      <AuthMeta label="Account recovery [Sec_auth]" right="Strict_challenge" />

      <div className="space-y-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Forgot your password?
        </h1>
        <p className="text-sm leading-6 text-neutral-600">
          Enter the email you use for DocuMind and we&apos;ll send you a reset link.
        </p>
      </div>

      <div className="mt-5">
        <AuthError message={errorMessage} />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="email" className={authLabel}>
              Email
            </Label>
            <span className={authMicro}>Primary_addr</span>
          </div>
          <div className="relative">
            <Mail className={authIcon} />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              className={authInput}
              {...register("email")}
            />
          </div>
          <FieldError message={errors.email?.message} />
        </div>

        <Button type="submit" className={authButton} disabled={isSubmitting}>
          <span>{isSubmitting ? "Transmitting" : "Send reset link"}</span>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf6] pt-5">
        <span className="text-sm text-neutral-600">Remembered it?</span>
        <Link
          href="/login"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-950 underline decoration-[#d91e4a] decoration-2 underline-offset-4 hover:text-[#d91e4a]"
        >
          Back to sign in
        </Link>
      </div>

      <AuthStatusStrip left="Enclave: Isolated" right="TLS 1.3 Active" />
    </div>
  );
}