"use client";

import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon } from "./icons";
import { Button, IconButton } from "./ui";

type Props = {
  prototypeId: string;
  /** compact icon on cards; button on review header */
  variant?: "icon" | "button";
  className?: string;
  onChange?: (watching: boolean) => void;
};

export function WatchToggle({
  prototypeId,
  variant = "button",
  className = "",
  onChange,
}: Props) {
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}/watch`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load watch status");
      setWatching(Boolean(data.watching));
      setCount(Number(data.watcherCount) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load watch status");
    }
  }

  useEffect(() => {
    load();
  }, [prototypeId]);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}/watch`, {
        method: watching ? "DELETE" : "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update watch");
      setWatching(Boolean(data.watching));
      setCount(Number(data.watcherCount) || 0);
      onChange?.(Boolean(data.watching));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update watch");
    } finally {
      setBusy(false);
    }
  }

  const label = watching
    ? "Unsubscribe — stop comment emails"
    : "Watch — get emails when someone comments";

  if (variant === "icon") {
    return (
      <div className={className}>
        <IconButton label={label} onClick={toggle} disabled={busy} aria-pressed={watching}>
          {watching ? <BellIcon className="h-4 w-4" style={{ color: "var(--accent)" }} /> : <BellOffIcon className="h-4 w-4" />}
        </IconButton>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        variant={watching ? "outline" : "ghost"}
        onClick={toggle}
        disabled={busy}
        aria-pressed={watching}
        title={label}
      >
        <span className="inline-flex items-center gap-2">
          {watching ? <BellIcon className="h-4 w-4" /> : <BellOffIcon className="h-4 w-4" />}
          {busy ? "Updating…" : watching ? "Unsubscribe" : "Watch"}
          {count > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {count}
            </span>
          )}
        </span>
      </Button>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
