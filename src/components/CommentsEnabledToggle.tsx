"use client";

import { useEffect, useState } from "react";
import { Tip } from "./ui";

type Props = {
  prototypeId: string;
  /** false = comments off on live page; undefined/true = on */
  enabled?: boolean;
  /** /~user/slug/ used to sync the live comment service immediately */
  liveSiteId?: string;
  /** When set with username, toggle pushes HTML meta to the live site */
  password?: string;
  username?: string;
  isPublished?: boolean;
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
  password,
  username,
  isPublished = false,
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
          password: password?.trim() || undefined,
          username: username?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update comments");
      if (typeof data.hint === "string") onHint?.(data.hint);
      if (typeof data.error === "string" && data.needsRepublish) {
        onError?.(data.error);
      } else if (isPublished && data.needsRepublish && !password?.trim()) {
        onError?.(
          "Enter your NetApp password on this card, then toggle again to update the live page.",
        );
      }
      onUpdated?.();
    } catch (err) {
      setOptimistic(null);
      onError?.(err instanceof Error ? err.message : "Could not update comments");
    } finally {
      setBusy(false);
    }
  }

  const tip = isPublished
    ? isOn
      ? "Comment bubble on for the live link. Click to turn it off (needs password on the card to update ux.netapp.com)."
      : "Comment bubble off. Click to turn it on (needs password on the card to update ux.netapp.com)."
    : isOn
      ? "Comments will be on when you publish."
      : "Comments will stay off when you publish.";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">Comments on live page</p>
        {isPublished && !password?.trim() ? (
          <p className="text-xs text-amber-200/80">Password needed to update the live link</p>
        ) : null}
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
