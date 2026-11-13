"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, AtSign, Loader2, Lock } from "lucide-react";
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
  AuthMeta,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginValues } from "@/lib/validation";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  if (!value.startsWith("/app")) return "/app/dashboard";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      toast.success("Welcome back");
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      // error is rendered from the mutation state
    }
  });

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Unable to sign in. Please try again."
        : null;

  return (
    <div className={cn(authCard, "shadow-[6px_6px_0_rgba(17,17,17,0.05)]")}>
      <AuthMeta label="Auth :: 01" right="Sys_key: Active" />

      <div className="space-y-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
          Welcome back
        </h1>
        <p className="text-sm leading-6 text-neutral-600">
          Sign in to chat with your documents and pick up where you left off.
        </p>
      </div>

      <div className="mt-5">
        <AuthError message={errorMessage} />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="email" className={authLabel}>
              Email
            </Label>
            <span className={authMicro}>Required</span>
          </div>
          <div className="relative">
            <AtSign className={authIcon} />
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
            <Link
              href="/forgot-password"
              className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d91e4a] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className={authIcon} />
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              className={cn(authInput, "pr-12")}
              {...register("password")}
            />
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <Button type="submit" className={authButton} disabled={isSubmitting}>
          <span>{isSubmitting ? "Verifying" : "Authorize & sign in"}</span>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf6] pt-5">
        <span className="text-sm text-neutral-600">New to DocuMind?</span>
        <Link
          href="/register"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-950 underline decoration-[#d91e4a] decoration-2 underline-offset-4 hover:text-[#d91e4a]"
        >
          Create an account
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="border border-[#e4e0f2] bg-[#f0eef9] px-3 py-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-neutral-500">
            Index engine
          </p>
          <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-900">
            Chroma DB · k=5
          </p>
        </div>
        <div className="border border-[#e4e0f2] bg-[#f0eef9] px-3 py-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-neutral-500">
            LLM execution
          </p>
          <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-900">
            Ollama · local
          </p>
        </div>
      </div>
    </div>
  );
}