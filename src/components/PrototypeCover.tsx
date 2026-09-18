"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon } from "./icons";
import { Badge, IconButton } from "./ui";
import {
  coverInitials,
  coverPaletteFor,
  isSharedLocalPreview,
} from "@/lib/coverPlaceholder";
import type { Prototype } from "@/lib/types";

type PreviewStatus =
  | { mode: "custom"; coverImage: string }
  | {
      mode: "auto";
      url: string;
      reachable: boolean;
      isLocal?: boolean;
      localPort?: number | null;
    };

function UniqueDraftCover({
  prototype,
  localPort,
}: {
  prototype: Prototype;
  localPort?: number | null;
}) {
  const palette = coverPaletteFor(prototype.id);
  const initials = coverInitials(prototype.name);
  const port = localPort ?? prototype.localPort;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{
        background: `linear-gradient(${palette.angle}deg, ${palette.from} 0%, ${palette.via} 48%, ${palette.to} 100%)`,
      }}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/25 text-3xl font-semibold tracking-tight text-white backdrop-blur-sm">
        {initials}
      </div>
      <p className="mt-4 max-w-[80%] truncate text-sm font-medium text-white/90">
        {prototype.name}
      </p>
      <p className="mt-2 text-xs text-white/70">
        {port
          ? `Dev preview not running · localhost:${port}`
          : "Dev preview not running"}
      </p>
      {port && (
        <p className="mt-1 max-w-xs text-[11px] text-white/50">
          In blueprint-app run: npm run dev
        </p>
      )}
    </div>
  );
}

export function PrototypeCover({
  prototype,
  isOwn,
  isPublished,
  uploadingCover,
  onUploadCover,
  onUseLivePreview,
}: {
  prototype: Prototype;
  isOwn: boolean;
  isPublished: boolean;
  uploadingCover?: boolean;
  onUploadCover?: (file: File) => void;
  onUseLivePreview?: () => void;
}) {
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    if (prototype.coverMode === "custom" && prototype.coverImage) {
      setStatus({ mode: "custom", coverImage: prototype.coverImage });
      return;
    }

    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/preview-status`);
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const data = (await res.json()) as PreviewStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [prototype.id, prototype.coverMode, prototype.coverImage]);

  useEffect(() => {
    loadStatus();
    const interval = window.setInterval(loadStatus, 8000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const showCustom = status?.mode === "custom" && status.coverImage;
  const liveUrl =
    status?.mode === "auto" && status.reachable && status.url ? status.url : null;
  // Allow localhost only when this prototype has its own port (reachable check already scoped)
  const showLive = Boolean(
    liveUrl &&
      (isPublished
        ? !isSharedLocalPreview(liveUrl)
        : status?.mode === "auto" && status.isLocal && status.reachable),
  );

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0b0f]">
      {showCustom ? (
        <img
          src={`${status.coverImage}?v=${prototype.updatedAt}`}
          alt={`${prototype.name} cover`}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : showLive && liveUrl ? (
        <iframe
          title={`${prototype.name} preview`}
          src={liveUrl}
          className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25] border-0 bg-white"
          loading="lazy"
        />
      ) : (
        <UniqueDraftCover
          prototype={prototype}
          localPort={
            status?.mode === "auto" ? status.localPort : prototype.localPort
          }
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone={isPublished ? "success" : "warning"}>
              {isPublished ? "Published" : "Draft"}
            </Badge>
          </div>

          {isOwn && onUploadCover && (
            <div className="flex shrink-0 items-center gap-1">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadCover(file);
                  event.target.value = "";
                }}
              />
              <IconButton
                label={showCustom ? "Replace cover image" : "Set cover image"}
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="h-9 w-9 bg-black/40 backdrop-blur"
              >
                <ImageIcon className="h-4 w-4" />
              </IconButton>
              {showCustom && onUseLivePreview && (
                <button
                  type="button"
                  onClick={onUseLivePreview}
                  className="rounded-full bg-black/40 px-2.5 py-1.5 text-xs text-zinc-200 backdrop-blur transition hover:bg-white/10"
                >
                  Auto
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-medium text-white">{prototype.name}</h3>
        </div>
      </div>
    </div>
  );
}
