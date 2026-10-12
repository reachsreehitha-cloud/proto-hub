"use client";

import { createPortal } from "react-dom";
import { Button } from "./ui";
import {
  GITHUB_ACCESS_GUIDE,
  PUBLISH_HELP_CONTACTS,
  UX_HOST,
} from "@/lib/publishGuide";

type Phase = "confirm" | "publishing" | "done";

export function PublishGuideDialog({
  open,
  phase,
  prototypeName,
  liveUrl,
  isRepublish,
  error,
  commentsEnabled = true,
  onCommentsEnabledChange,
  onClose,
  onConfirmPublish,
}: {
  open: boolean;
  phase: Phase;
  prototypeName: string;
  liveUrl: string;
  isRepublish: boolean;
  error?: string;
  commentsEnabled?: boolean;
  onCommentsEnabledChange?: (enabled: boolean) => void;
  onClose: () => void;
  onConfirmPublish: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-guide-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && phase !== "publishing") onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Publish</p>
            <h2 id="publish-guide-title" className="mt-1 text-xl font-semibold tracking-tight text-white">
              {phase === "done"
                ? "You’re live"
                : phase === "publishing"
                  ? "Publishing…"
                  : UX_HOST}
            </h2>
          </div>
          {phase !== "publishing" && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-sm text-zinc-500 hover:text-white"
            >
              Close
            </button>
          )}
        </div>

        {phase === "confirm" && (
          <div className="space-y-5">
            <ul className="space-y-2.5 text-[15px] leading-relaxed text-zinc-400">
              <li>
                <span className="text-zinc-200">GitHub access</span>
                {" is required. "}
                <a
                  className="text-white underline decoration-white/25 underline-offset-4"
                  href={GITHUB_ACCESS_GUIDE}
                  target="_blank"
                  rel="noreferrer"
                >
                  Guide
                </a>
                {" · "}
                {PUBLISH_HELP_CONTACTS}
              </li>
              <li>
                <span className="text-zinc-200">VPN</span>
                {" should stay connected."}
              </li>
              <li>
                <span className="text-zinc-200">OpenLab id + password</span>
                {" are already on the card."}
              </li>
            </ul>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-white">Comments on live page</p>
                <p className="mt-0.5 text-[13px] text-zinc-500">
                  Turns on the commenter bubble for everyone on the link.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={commentsEnabled}
                aria-label="Comments on live page"
                disabled={!onCommentsEnabledChange}
                onClick={() => onCommentsEnabledChange?.(!commentsEnabled)}
                className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 ${
                  commentsEnabled ? "bg-emerald-400" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ease-out ${
                    commentsEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <div className="flex justify-between gap-3 pt-1">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onConfirmPublish}>
                {isRepublish ? "Republish" : "Publish"}
              </Button>
            </div>
          </div>
        )}

        {phase === "publishing" && (
          <p className="text-[15px] text-zinc-400">
            Building and uploading “{prototypeName}”. Keep VPN on.
            {commentsEnabled ? " Comments will be on." : " Comments will stay off."}
          </p>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 underline-offset-2 hover:underline"
              >
                {liveUrl}
              </a>
            )}
            <p className="text-[15px] text-zinc-500">
              {commentsEnabled
                ? "Share that link. The comment bubble is on for visitors."
                : "Share that link. Comments are off until you turn them on."}
            </p>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
