"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  AuthMeta,
  AuthStatusStrip,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useRegister } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { registerSchema, type RegisterValues } from "@/lib/validation";

export function RegisterForm() {
  const router = useRouter();
  const signup = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signup.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success("Your workspace is ready");
      router.replace("/app/dashboard");
      router.refresh();
    } catch {
      // error is rendered from the mutation state
    }
  });

  const errorMessage =
    signup.error instanceof ApiError
      ? signup.error.message
      : signup.error
        ? "Unable to create your account. Please try again."
        : null;

  return (
    <div className={cn(authCard, "shadow-[6px_6px_0_rgba(17,17,17,0.05)]")}>
      <AuthMeta label="System enrollment [Node_init]" right="Sys_key: Active" />

      <div className="space-y-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Create your account
        </h1>
        <p className="text-sm leading-6 text-neutral-600">
          Start turning static documents into answers in under a minute.
        </p>
      </div>

      <div className="mt-5">
        <AuthError message={errorMessage} />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="name" className={authLabel}>
              Full name
            </Label>
            <span className={authMicro}>Legal_id</span>
          </div>
          <div className="relative">
            <User className={authIcon} />
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={Boolean(errors.name)}
              className={authInput}
              {...register("name")}
            />
          </div>
          <FieldError message={errors.name?.message} />
        </div>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className={authLabel}>
              Password
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
              Confirm password
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
          <span>{isSubmitting ? "Provisioning" : "Create account"}</span>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf6] pt-5">
        <span className="text-sm text-neutral-600">Already have an account?</span>
        <Link
          href="/login"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-950 underline decoration-[#d91e4a] decoration-2 underline-offset-4 hover:text-[#d91e4a]"
        >
          Sign in
        </Link>
      </div>

      <AuthStatusStrip left="Enclave: Isolated" right="TLS 1.3 Active" />
    </div>
  );
}