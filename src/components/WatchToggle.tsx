"use client";

import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon } from "./icons";
import { Button, IconButton, Tip } from "./ui";

type Props = {
  prototypeId: string;
  /** compact icon on cards; button on review header */
  variant?: "icon" | "button";
  className?: string;
  onChange?: (watching: boolean) => void;
  /**
   * When true (prototype owner), hide this control on cards.
   * Authors are already notified; this is only "email me" for other people.
   */
  hideForOwner?: boolean;
};

/** Personal email alerts for you only. Not the live-page comment bubble. */
const TIP_ON = "Email alerts on for you only. Click to stop emails to your inbox.";
const TIP_OFF = "Email me when someone comments. Only affects your inbox, not other people.";

export function WatchToggle({
  prototypeId,
  variant = "button",
  className = "",
  onChange,
  hideForOwner = false,
}: Props) {
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}/watch`);
      if (res.status === 404) {
        setAvailable(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      setAvailable(true);
      setWatching(Boolean(data.watching));
      setCount(Number(data.watcherCount) || 0);
    } catch {
      setAvailable(false);
    }
  }

  useEffect(() => {
    if (hideForOwner) return;
    void load();
  }, [prototypeId, hideForOwner]);

  async function toggle() {
    if (!available) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}/watch`, {
        method: watching ? "DELETE" : "POST",
      });
      if (res.status === 404) {
        setAvailable(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) return;
      setWatching(Boolean(data.watching));
      setCount(Number(data.watcherCount) || 0);
      onChange?.(Boolean(data.watching));
    } finally {
      setBusy(false);
    }
  }

  if (hideForOwner || !available) return null;

  const tip = watching ? TIP_ON : TIP_OFF;

  if (variant === "icon") {
    return (
      <div className={className}>
        <IconButton label={tip} onClick={() => void toggle()} disabled={busy} aria-pressed={watching}>
          {watching ? (
            <BellIcon className="h-4 w-4" style={{ color: "var(--accent)" }} />
          ) : (
            <BellOffIcon className="h-4 w-4" />
          )}
        </IconButton>
      </div>
    );
  }

  return (
    <div className={className}>
      <Tip label={tip}>
        <Button
          variant={watching ? "outline" : "ghost"}
          onClick={() => void toggle()}
          disabled={busy}
          aria-pressed={watching}
          aria-label={tip}
        >
          <span className="inline-flex items-center gap-2">
            {watching ? <BellIcon className="h-4 w-4" /> : <BellOffIcon className="h-4 w-4" />}
            {busy ? "Updating…" : watching ? "Stop my emails" : "Email me on comments"}
            {count > 0 && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {count}
              </span>
            )}
          </span>
        </Button>
      </Tip>
    </div>
  );
}
