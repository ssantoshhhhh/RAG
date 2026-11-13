"use client";

import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe, useStats } from "@/lib/queries";
import { cn, initials } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/chat", label: "Chat", icon: MessageSquare },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
              active
                ? "bg-neutral-950 text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
            )}
          >
            <item.icon
              className={cn("h-4 w-4", active ? "text-white" : "text-neutral-500")}
            />
            <span className="flex-1">{item.label}</span>
            {active ? <span className="h-1.5 w-1.5 bg-[#d91e4a]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { data: user } = useMe();
  const { data: stats } = useStats();
  const logout = useLogout();
  const router = useRouter();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace("/login");
        router.refresh();
        toast.success("Signed out");
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-5 py-5">
        <Link href="/app/dashboard" onClick={onNavigate} aria-label="Home">
          <Logo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />

        <div className="mt-8 border border-neutral-200 bg-[#fafafa] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d91e4a]">
              <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
              Knowledge base
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
              V1.2
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase leading-5 tracking-[0.04em] text-neutral-500">
            {stats
              ? `${stats.indexed_document_count} indexed document${
                  stats.indexed_document_count === 1 ? "" : "s"
                } · ${stats.chunk_count} chunks`
              : "Upload a document to get started."}
          </p>
          <Link
            href="/app/documents"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1.5 border-b border-neutral-950 pb-0.5 text-[11px] font-medium text-neutral-950 transition-colors hover:border-[#d91e4a] hover:text-[#d91e4a]"
          >
            Manage documents
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="border-t border-neutral-200 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-neutral-50 focus:outline-none"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-neutral-950 font-mono text-[11px] font-semibold text-white">
                {initials(user?.name ?? "DocuMind")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-neutral-950">
                  {user?.name ?? "Account"}
                </span>
                <span className="block truncate font-mono text-[10px] tracking-[0.02em] text-neutral-500">
                  {user?.email ?? ""}
                </span>
              </span>
              <MoreHorizontal className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" onClick={onNavigate}>
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleLogout}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isChat = pathname.startsWith("/app/chat");
  const activeLabel =
    NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ?? "Workspace";

  return (
    <div className="min-h-dvh bg-[#f7f7f8] lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[300px] border-r border-neutral-200 bg-white lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-400 sm:inline">
            {activeLabel}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-neutral-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] border-r border-neutral-200 bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[300px]">
        <main
          className={cn(
            isChat
              ? "h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden lg:h-dvh lg:flex-1"
              : "flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}