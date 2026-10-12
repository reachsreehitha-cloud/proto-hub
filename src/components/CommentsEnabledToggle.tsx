"use client";

import { useEffect, useState } from "react";
import { Tip } from "./ui";

type Props = {
  prototypeId: string;
  /** false = comments off on live page; undefined/true = on */
  enabled?: boolean;
  /** /~user/slug/ used to sync the live comment service immediately */
  liveSiteId?: string;
  onUpdated?: () => void;
  onHint?: (hint: string) => void;
  onError?: (message: string) => void;
};

/**
 * Owner control: turn shared live-page commenting off/on from Proto Hub.
 */
export function CommentsEnabledToggle({
  prototypeId,
  enabled = true,
  liveSiteId,
  onUpdated,
  onHint,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const isOn = optimistic ?? enabled !== false;

  useEffect(() => {
    setOptimistic(null);
  }, [enabled, prototypeId]);

  async function toggle() {
    if (busy) return;
    const next = !isOn;
    setBusy(true);
    setOptimistic(next);
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentsEnabled: next,
          liveSiteId: liveSiteId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update comments");
      if (typeof data.hint === "string") onHint?.(data.hint);
      onUpdated?.();
    } catch (err) {
      setOptimistic(null);
      onError?.(err instanceof Error ? err.message : "Could not update comments");
    } finally {
      setBusy(false);
    }
  }

  const tip = isOn
    ? "Comment bubble on the live page for everyone. Click to hide it for all visitors."
    : "Comment bubble hidden on the live page for everyone. Click to show it again.";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">Comments on live page</p>
        <p className="text-xs text-zinc-500">For everyone viewing the link (not your email)</p>
      </div>
      <Tip label={tip} side="bottom">
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={tip}
          disabled={busy}
          onClick={() => void toggle()}
          className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${
            isOn ? "bg-emerald-400" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ease-out ${
              isOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </Tip>
    </div>
  );
}
