"use client";

import { useState } from "react";

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
 * Works with Apache sitewide inject — overlay checks this setting on load.
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
  const isOn = enabled !== false;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentsEnabled: !isOn,
          liveSiteId: liveSiteId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update comments");
      if (typeof data.hint === "string") onHint?.(data.hint);
      onUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not update comments");
    } finally {
      setBusy(false);
    }
  }

  const hint = isOn
    ? "Comment bubble shows on the published page. Only you can change this."
    : "Comment bubble is hidden. Only you can turn it back on.";

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-zinc-300" title={hint}>
        Live comments
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={isOn ? "Turn live comments off" : "Turn live comments on"}
        title={hint}
        disabled={busy}
        onClick={() => void toggle()}
        className={`relative h-6 w-10 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 ${
          isOn ? "bg-white" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-[left] ${
            isOn ? "left-[1.125rem] bg-zinc-900" : "left-0.5 bg-zinc-200"
          }`}
        />
      </button>
    </div>
  );
}
