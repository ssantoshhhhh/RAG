import { Check } from "lucide-react";
import Link from "next/link";

import { authMicro } from "@/components/auth/auth-ui";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    title: "Upload PDFs or text files in seconds",
    detail: "Instant chunking pipeline with structured metadata.",
  },
  {
    title: "Ask questions in plain language",
    detail: "Context-aware retrieval powered by local inference.",
  },
  {
    title: "Every answer cites the exact page it came from",
    detail: "Deterministic provenance with inline citations.",
    accent: true,
  },
];

const STATS = [
  {
    label: "Index engine",
    value: "Chroma Vector DB",
    note: "Cosine distance (k=5)",
  },
  {
    label: "LLM execution",
    value: "Ollama Local Edge",
    note: "llama3:instruct",
  },
];

function MarketingPanel() {
  return (
    <div className="flex h-full max-w-[580px] flex-col justify-center">
      <div className="mb-10 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-950">
          <span className="h-2 w-2 bg-neutral-950" />
          DocuMind [Kernel v2.4]
        </span>
        <span className="flex items-center gap-1.5 border border-[#dcd8ef] bg-white px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#d91e4a]">
          <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
          Node online
        </span>
      </div>

      <span className="mb-4 inline-flex w-fit items-center border border-neutral-950 bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-950 shadow-[3px_3px_0_#111]">
        Secure context pipeline
      </span>

      <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-neutral-950 xl:text-[3.4rem]">
        Turn your documents
        <br />
        into a conversation.
      </h2>

      <p className="mt-5 max-w-md text-[15px] leading-7 text-neutral-600">
        DocuMind reads your files, finds the passages that matter, and answers with
        citations you can verify.
      </p>

      <ul className="mt-8 space-y-2.5">
        {HIGHLIGHTS.map((highlight) => (
          <li
            key={highlight.title}
            className="flex items-start gap-3 border border-[#e4e0f2] bg-white px-3.5 py-3"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-white",
                highlight.accent ? "bg-[#d91e4a]" : "bg-neutral-950",
              )}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>
              <span className="block text-[13px] font-medium leading-5 text-neutral-900">
                {highlight.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-5 text-neutral-500">
                {highlight.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid max-w-[540px] grid-cols-2 gap-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="border border-[#e4e0f2] bg-white p-3.5">
            <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {stat.label}
            </p>
            <p className="mt-1.5 text-[15px] font-semibold leading-5 text-neutral-950">
              {stat.value}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#d91e4a]">
              {stat.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileMarketing() {
  return (
    <div className="border border-[#e4e0f2] bg-white p-5 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d91e4a]">
          <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
          Autonomous indexing
        </span>
        <span className={authMicro}>v2.4</span>
      </div>
      <h1 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-950">
        Turn your documents into a conversation.
      </h1>
      <ul className="mt-4 space-y-1.5">
        {HIGHLIGHTS.map((highlight) => (
          <li key={highlight.title} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center text-white",
                highlight.accent ? "bg-[#d91e4a]" : "bg-neutral-950",
              )}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className="text-[12px] leading-5 text-neutral-700">
              {highlight.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f3fb] p-2 sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1500px] flex-col border border-[#8b7cf6] bg-[#f4f3fb] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#dcd8ef] px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-9 w-auto" />
            <span className={cn(authMicro, "hidden sm:inline")}>[AUTH_GATE]</span>
          </Link>

          <div className="hidden items-center gap-5 md:flex">
            <span className={cn(authMicro, "flex items-center gap-1.5")}>
              <span className="h-1.5 w-1.5 bg-neutral-950" />
              Node: 01_PRIMARY [Latency: 12ms]
            </span>
            <span className={cn(authMicro, "flex items-center gap-1.5")}>
              <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
              Status: Secure_idle
            </span>
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[1.08fr_0.92fr]">
          <aside className="hidden flex-col justify-center p-10 lg:flex xl:p-14">
            <MarketingPanel />
          </aside>

          <main className="flex flex-col justify-center gap-6 px-4 py-8 sm:px-8 lg:border-l lg:border-[#e2def1] lg:px-10 lg:py-12 xl:px-14">
            <div className="w-full max-w-[480px] self-center">
              <MobileMarketing />
            </div>
            <div className="w-full max-w-[480px] self-center">{children}</div>
          </main>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#dcd8ef] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Engine: RAG_V4.2</span>
            <span>Proto: TLS_1.3_STRICT</span>
            <span className="hidden sm:inline">Cipher: AES_256_GCM</span>
          </span>
          <span>DocuMind Architecture © 2025 · Region: US_EAST_CLUSTER</span>
        </footer>
      </div>
    </div>
  );
}