"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";
import { Logo } from "@/components/logo";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError, error, refetch } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isError) return;
    if (error instanceof ApiError && error.status === 401) {
      const next = encodeURIComponent(pathname || "/app/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [error, isError, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  if (isError) {
    const unauthorized = error instanceof ApiError && error.status === 401;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        {unauthorized ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to sign in…
          </div>
        ) : (
          <div className="w-full max-w-md">
            <ErrorState
              title="Could not load your session"
              message={
                error instanceof ApiError
                  ? error.message
                  : "Check that the backend is running and try again."
              }
              onRetry={() => void refetch()}
            />
          </div>
        )}
      </div>
    );
  }

  if (!data) return null;
  return <>{children}</>;
}