"use client";

import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { MessageIcon } from "./icons";
import { Button } from "./ui";
import { HELP_FORM_URL } from "@/lib/publishGuide";

type Shot = { name: string; dataUrl: string };

const MAX_SHOTS = 6;
const MAX_SHOT_BYTES = 1_200_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function ReportSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [whatHappened, setWhatHappened] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [sending, setSending] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open || typeof document === "undefined") return null;

  async function addShots(files: FileList | null) {
    if (!files?.length) return;
    const next: Shot[] = [...shots];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_SHOTS) break;
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_SHOT_BYTES) {
        setReportMsg("One image is too large. Keep each under about 1 MB.");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({ name: file.name || `screenshot-${next.length + 1}.png`, dataUrl });
      } catch {
        // skip
      }
    }
    setShots(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    const text = whatHappened.trim();
    if (!text) return;
    setSending(true);
    setReportMsg("");
    try {
      const res = await fetch("/api/help/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatHappened: text,
          screenshots: shots.map((s) => ({ name: s.name, dataUrl: s.dataUrl })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setReportMsg(
        typeof data.message === "string" ? data.message : "Thanks. We’ll take a look.",
      );
      setWhatHappened("");
      setShots([]);
    } catch (err) {
      setReportMsg(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Feedback</p>
            <h2 id="report-title" className="mt-1 text-xl font-semibold tracking-tight text-white">
              What’s going wrong?
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-500">
              List everything you ran into. Screenshots help a lot.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-white">
            Close
          </button>
        </div>

        {HELP_FORM_URL ? (
          <a
            href={HELP_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-flex text-[15px] text-white underline decoration-white/25 underline-offset-4"
          >
            Prefer a web form?
          </a>
        ) : null}

        <form onSubmit={(e) => void submitReport(e)} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">What happened</span>
            <textarea
              required
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              rows={8}
              placeholder={
                "Write it out like a short note. For example:\n\n1. Open preview stays blank\n2. Publish asks for a password I already entered\n3. Help text is hard to follow"
              }
              className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[15px] leading-relaxed text-white placeholder:text-zinc-600 outline-none focus:border-white/25"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">Screenshots</span>
              <span className="text-xs text-zinc-600">Up to {MAX_SHOTS}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void addShots(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={shots.length >= MAX_SHOTS}
              className="w-full rounded-xl border border-dashed border-white/15 px-4 py-3 text-[15px] text-zinc-400 transition hover:border-white/30 hover:text-zinc-200 disabled:opacity-40"
            >
              Add screenshots
            </button>
            {shots.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 pt-1">
                {shots.map((shot, index) => (
                  <li
                    key={`${shot.name}-${index}`}
                    className="relative overflow-hidden rounded-lg border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.dataUrl} alt="" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setShots((list) => list.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                      aria-label="Remove screenshot"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={sending || !whatHappened.trim()}>
              {sending ? "Sending…" : "Send"}
            </Button>
            {reportMsg ? <p className="text-sm text-zinc-400">{reportMsg}</p> : null}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Floating Report control. Use once at the Dashboard so it shows on every page. */
export function FeedbackReportFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] flex h-14 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium text-zinc-900 shadow-xl shadow-black/40 transition hover:scale-[1.02] active:scale-[0.98]"
        aria-label="Send feedback"
      >
        <MessageIcon className="h-5 w-5" />
        Report
      </button>
      <ReportSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
