"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { AuthError } from "@/components/auth/auth-error";
import { FieldError } from "@/components/auth/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useForgotPassword } from "@/lib/queries";
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
      <div className="space-y-6">
        <div className="space-y-1.5">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">{forgot.data.message}</p>
        </div>

        {forgot.data.reset_url ? (
          <div className="space-y-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Development mode
            </p>
            <p className="text-sm text-indigo-900">
              Email delivery is not configured, so use this link directly:
            </p>
            <Link
              href={forgot.data.reset_url}
              className="block break-all text-sm font-medium text-indigo-600 hover:underline"
            >
              Open reset link
            </Link>
          </div>
        ) : null}

        <Button asChild variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the email you use for DocuMind and we&apos;ll send you a reset link.
        </p>
      </div>

      <AuthError message={errorMessage} />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send reset link
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}