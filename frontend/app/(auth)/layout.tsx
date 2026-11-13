import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/logo";

const HIGHLIGHTS = [
  "Upload PDFs or text files in seconds",
  "Ask questions in plain language",
  "Every answer cites the exact page it came from",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Sparkles className="h-4.5 w-4.5 text-indigo-300" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">DocuMind</span>
        </Link>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Turn your documents into a conversation.
          </h2>
          <p className="text-[15px] leading-relaxed text-slate-400">
            DocuMind reads your files, finds the passages that matter, and answers with
            citations you can verify. No more scrolling through hundreds of pages.
          </p>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                  <Check className="h-3 w-3" />
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          Built with FastAPI, ChromaDB, and Ollama.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}