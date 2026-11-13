"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthError } from "@/components/auth/auth-error";
import { FieldError } from "@/components/auth/field-error";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useResetPassword } from "@/lib/queries";
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
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Invalid reset link
          </h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is missing or incomplete. Request a new one to continue.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your DocuMind account.
        </p>
      </div>

      <AuthError message={errorMessage} />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password?.message ? (
            <FieldError message={errors.password.message} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Use at least 8 characters with a letter and a number.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Update password
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}