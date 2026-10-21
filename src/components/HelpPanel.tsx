"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import { Button } from "./ui";
import {
  GITHUB_ACCESS_GUIDE,
  PUBLISH_HELP_CONTACTS,
  UX_HOST,
} from "@/lib/publishGuide";

type IssueCard = {
  title: string;
  prompt: string;
};

const ISSUES: IssueCard[] = [
  {
    title: "The page feels too skinny",
    prompt:
      "Widen this Console page: use BpContentRegion width=\"full\". Keep PrototypeShell. Match FIGMA_COMPONENT_CONFIG.md. Do not add custom max-width wrappers.",
  },
  {
    title: "Spacing looks off",
    prompt:
      "Fix page spacing to Proto Hub Console defaults. Use PageAlert and MetricPropertyBand from consolePatterns.tsx. Keep index.css filter overrides. Do not invent padding CSS.",
  },
  {
    title: "Filters wrap or look uneven",
    prompt:
      "Fix BpSimpleFilters layout for Console density. Keep Proto Hub index.css filter overrides and BpContentRegion width=\"full\". Do not invent filter CSS.",
  },
  {
    title: "The side menu stops halfway down",
    prompt:
      "Make BpServiceNav fill the full viewport height under the header. Keep PrototypeShell stretch styles and main-region rules in index.css. Do not wrap nav in a content-sized stack.",
  },
  {
    title: "Things break when I resize the window",
    prompt:
      "Fix responsive layout for this Console page. Keep Blueprint components and PrototypeShell. Prefer Blueprint responsive props over custom breakpoints. Match Console density.",
  },
  {
    title: "Colors look pale or unfinished",
    prompt:
      "Keep import \"@netapp/blueprint/css\" in main.tsx. Never use prototype or concept fidelity CSS. Restore production Blueprint styling and PrototypeShell.",
  },
  {
    title: "My latest changes are not showing",
    prompt:
      "Start or fix the local Vite preview in blueprint-app so changes show. Keep @netapp/blueprint/css. Tell me the localhost URL when ready.",
  },
  {
    title: "I need empty, loading, or error states",
    prompt:
      "Add empty, loading, and error states with Blueprint only (BpEmptyState or BpNotification and BpButton). Match Console density. Keep hash routes and PrototypeShell.",
  },
  {
    title: "Build a full list page for me",
    prompt:
      "Build a Console discovery page: title and actions, PageAlert, MetricPropertyBand, BpSimpleFilters, and a realistic table. Reuse consolePatterns.tsx. Follow FIGMA_COMPONENT_CONFIG.md. Keep PrototypeShell and @netapp/blueprint/css.",
  },
];

const PATH = [
  {
    id: "create",
    label: "Create",
    art: (
      <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
        <rect x="28" y="14" width="64" height="52" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" />
        <path d="M60 30v20M50 40h20" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "cursor",
    label: "Cursor",
    art: (
      <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
        <rect x="18" y="12" width="84" height="56" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" />
        <rect x="26" y="22" width="40" height="6" rx="2" fill="rgba(255,255,255,0.2)" />
        <rect x="26" y="34" width="56" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
        <rect x="26" y="42" width="48" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
        <path d="M78 48l10 4-10 4 2-4z" fill="rgba(255,255,255,0.75)" />
      </svg>
    ),
  },
  {
    id: "preview",
    label: "Preview",
    art: (
      <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
        <rect x="22" y="10" width="76" height="50" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" />
        <rect x="30" y="20" width="18" height="34" rx="2" fill="rgba(255,255,255,0.08)" />
        <rect x="54" y="20" width="36" height="8" rx="2" fill="rgba(255,255,255,0.16)" />
        <rect x="54" y="34" width="36" height="20" rx="2" fill="rgba(255,255,255,0.08)" />
        <ellipse cx="60" cy="68" rx="18" ry="3" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    id: "publish",
    label: "Publish",
    art: (
      <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
        <circle cx="60" cy="40" r="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" />
        <path d="M60 52V28M50 38l10-10 10 10" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "share",
    label: "Share",
    art: (
      <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden>
        <circle cx="36" cy="40" r="8" fill="rgba(255,255,255,0.2)" />
        <circle cx="84" cy="26" r="8" fill="rgba(255,255,255,0.2)" />
        <circle cx="84" cy="54" r="8" fill="rgba(255,255,255,0.2)" />
        <path d="M43 36l28-8M43 44l28 8" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      </svg>
    ),
  },
];

function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        el.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="outline" onClick={() => void copy()} className="shrink-0">
      {copied ? (
        <>
          <CheckIcon className="mr-2 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <CopyIcon className="mr-2 h-4 w-4" />
          Copy for Cursor
        </>
      )}
    </Button>
  );
}

export function HelpPanel() {
  const [openIssue, setOpenIssue] = useState<string | null>(null);

  return (
    <div className="relative mx-auto max-w-4xl pb-16">
      <header className="mb-12 space-y-3 text-center sm:text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">Help</p>
        <h2 className="text-[2.5rem] font-semibold tracking-tight text-white sm:text-[2.75rem]">
          From idea to {UX_HOST}
        </h2>
        <p className="max-w-xl text-[17px] leading-relaxed text-zinc-500">
          Create your draft. Build in Cursor. Check the preview. Publish. Share the link.
        </p>
      </header>

      <section aria-label="How it works" className="mb-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PATH.map((step, index) => (
            <div key={step.id}>
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent">
                <div className="aspect-[3/2] px-2 pt-2">{step.art}</div>
                <p className="px-3 pb-3 text-center text-[13px] font-medium text-zinc-200">
                  <span className="text-zinc-600">{index + 1} </span>
                  {step.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16 space-y-6">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-white">Before you publish</h3>
          <p className="mt-2 max-w-lg text-[17px] text-zinc-500">
            You’ll need these three things ready.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href={GITHUB_ACCESS_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 7.5c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.59.69.48A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
              </svg>
            </div>
            <p className="text-[17px] font-medium text-white">GitHub (npm packages)</p>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-500">
              Proto Hub itself installs with one public command. You may still need GitHub/npm setup for NetApp packages. Guide, or ask {PUBLISH_HELP_CONTACTS}.
            </p>
          </a>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[17px] font-medium text-white">VPN</p>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-500">
              Keep it on while you publish.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <p className="text-[17px] font-medium text-white">OpenLab id</p>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-500">
              Your short username and NetApp password, entered on the draft card.
            </p>
          </div>
        </div>

        <p className="text-[15px] text-zinc-500">
          When publish finishes, you get a link on {UX_HOST}. Share that link.
        </p>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-white">Quick fixes for Cursor</h3>
          <p className="mt-2 max-w-lg text-[17px] text-zinc-500">
            Open one that matches what you see. Read the prompt. Copy it when you’re ready.
          </p>
        </div>

        <ul className="space-y-2">
          {ISSUES.map((item) => {
            const open = openIssue === item.title;
            return (
              <li
                key={item.title}
                className={`overflow-hidden rounded-2xl border transition ${
                  open
                    ? "border-white/20 bg-white/[0.04]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIssue(open ? null : item.title)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-[17px] font-medium text-white">{item.title}</span>
                  <span className={`text-zinc-500 transition ${open ? "rotate-90" : ""}`} aria-hidden>
                    ›
                  </span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-white/[0.06] px-5 pb-5 pt-4">
                    <div className="max-h-52 overflow-y-auto rounded-xl bg-black/40 px-4 py-3">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-300">
                        {item.prompt}
                      </p>
                    </div>
                    <CopyPromptButton text={item.prompt} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

    </div>
  );
}
