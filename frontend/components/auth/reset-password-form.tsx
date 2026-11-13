"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthError } from "@/components/auth/auth-error";
import { FieldError } from "@/components/auth/field-error";
import { PasswordInput } from "@/components/auth/password-input";
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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useResetPassword } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ token, password: values.password });
      toast.success("Password updated. Sign in with your new password.");
      router.replace("/login");
      router.refresh();
    } catch {
      // error is rendered from the mutation state
    }
  });

  const errorMessage =
    reset.error instanceof ApiError
      ? reset.error.message
      : reset.error
        ? "Unable to reset your password. Please try again."
        : null;

  if (!token) {
    return (
      <div className={cn(authCard, "shadow-[6px_6px_0_rgba(17,17,17,0.05)]")}>
        <AuthMeta label="Credential reset [Sec_auth]" right="Token: Missing" />

        <span className="mb-4 flex h-10 w-10 items-center justify-center border border-[#d91e4a] bg-[#fff1f4] font-mono text-lg font-semibold text-[#d91e4a]">
          !
        </span>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Invalid reset link
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          This password reset link is missing or incomplete. Request a new one to continue.
        </p>

        <Button asChild className={cn(authButton, "mt-6")}>
          <Link href="/forgot-password">
            <span>Request a new link</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <p className="mt-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
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
        <AuthBadge>Secure</AuthBadge>
      </div>

      <AuthMeta label="Credential reset [Sec_auth]" right="Token: Single_use" />

      <div className="space-y-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Set a new password
        </h1>
        <p className="text-sm leading-6 text-neutral-600">
          Choose a new password for your DocuMind account.
        </p>
      </div>

      <div className="mt-5">
        <AuthError message={errorMessage} />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className={authLabel}>
              New password
            </Label>
            <span className={authMicro}>Encrypted</span>
          </div>
          <div className="relative">
            <Lock className={authIcon} />
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={Boolean(errors.password)}
              className={cn(authInput, "pr-12")}
              {...register("password")}
            />
          </div>
          {errors.password?.message ? (
            <FieldError message={errors.password.message} />
          ) : (
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-neutral-500">
              <span className="h-1 w-1 bg-[#d91e4a]" />
              Use at least 8 characters with a letter and a number.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="confirmPassword" className={authLabel}>
              Confirm new password
            </Label>
            <span className={authMicro}>Match_check</span>
          </div>
          <div className="relative">
            <Lock className={authIcon} />
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={Boolean(errors.confirmPassword)}
              className={cn(authInput, "pr-12")}
              {...register("confirmPassword")}
            />
          </div>
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <Button type="submit" className={authButton} disabled={isSubmitting}>
          <span>{isSubmitting ? "Updating" : "Update password"}</span>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf6] pt-5">
        <span className="text-sm text-neutral-600">Changed your mind?</span>
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