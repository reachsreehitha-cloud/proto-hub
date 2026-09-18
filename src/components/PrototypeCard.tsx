"use client";

import { useState } from "react";
import { PrototypeCover } from "./PrototypeCover";
import {
  CodeIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  TrashIcon,
} from "./icons";
import { Button, Card, IconButton, Input } from "./ui";
import type { Prototype } from "@/lib/types";
import { isSharedLocalPreview } from "@/lib/coverPlaceholder";

function authorLabel(prototype: Prototype, isOwn: boolean) {
  if (isOwn) return "You";
  return prototype.author?.trim() || prototype.authorEmail.split("@")[0] || "Someone";
}

/** Works on localhost even when navigator.clipboard is blocked. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function PrototypeCard({
  prototype,
  isOwn,
  galleryMode = false,
  accountId,
  onRefresh,
}: {
  prototype: Prototype;
  isOwn: boolean;
  /** Team gallery: same layout for every card - no owner publish/edit chrome. */
  galleryMode?: boolean;
  accountId?: string;
  onRefresh: () => void;
}) {
  const isPublished = prototype.status === "published";
  const showOwnerTools = isOwn && !galleryMode;
  const [publishing, setPublishing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [sshPassword, setSshPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const publishUsername = accountId || prototype.authorEmail.split("@")[0] || "";
  const expectedLiveUrl = publishUsername
    ? `https://ux.netapp.com/~${publishUsername}/${prototype.slug}/`
    : "";

  // Prefer the real published URL; ignore leftover localhost placeholders
  const liveUrl =
    prototype.previewUrl && !isSharedLocalPreview(prototype.previewUrl)
      ? prototype.previewUrl
      : expectedLiveUrl;

  async function continueBuilding() {
    setOpening(true);
    setActionError("");
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/open`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open editor");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not open editor");
    } finally {
      setOpening(false);
    }
  }

  async function publish() {
    if (!sshPassword.trim()) {
      setActionError("Enter your NetApp SSO password to publish.");
      return;
    }

    setPublishing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: sshPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setSshPassword("");
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    setActionError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/prototypes/${prototype.id}/cover`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cover upload failed");
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  }

  async function useLivePreview() {
    setActionError("");
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/cover`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not switch to live preview");
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not switch to live preview");
    }
  }

  async function showFolder() {
    setActionError("");
    let copied = false;
    try {
      copied = await copyText(prototype.folderPath);
      if (copied) {
        setPathCopied(true);
        window.setTimeout(() => setPathCopied(false), 2000);
      }
    } catch {
      // Finder open can still work without clipboard
    }

    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && !copied) throw new Error(data.error || "Could not open folder");
    } catch (err) {
      if (!copied) {
        setActionError(err instanceof Error ? err.message : "Could not open folder");
      }
    }
  }

  async function copyLiveLink() {
    if (!liveUrl) {
      setActionError("No live link yet - publish first.");
      return;
    }
    setActionError("");
    const ok = await copyText(liveUrl);
    if (!ok) {
      setActionError(`Could not copy. Select and copy manually: ${liveUrl}`);
      return;
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2500);
  }

  async function remove() {
    const confirmed = window.confirm(
      `Remove "${prototype.name}" from Proto Hub?\n\nYour project folder on Desktop will stay - only the hub listing is removed.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition hover:border-white/20 hover:bg-white/[0.05]">
      <PrototypeCover
        prototype={prototype}
        isOwn={showOwnerTools}
        isPublished={isPublished}
        uploadingCover={uploadingCover}
        onUploadCover={showOwnerTools ? uploadCover : undefined}
        onUseLivePreview={showOwnerTools ? useLivePreview : undefined}
      />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-zinc-400">
          {prototype.description || "No description yet."}
        </p>

        <p className="text-sm text-zinc-300">
          By <span className="font-medium text-white">{authorLabel(prototype, isOwn)}</span>
        </p>

        {isPublished && liveUrl && (
          <div className="flex items-center gap-3">
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {liveUrl}
            </a>
            <button
              type="button"
              onClick={copyLiveLink}
              aria-label={linkCopied ? "Link copied" : "Copy link"}
              aria-live="polite"
              className="shrink-0 text-xs font-medium text-zinc-300 underline-offset-2 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {linkCopied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {showOwnerTools && (
          <div className="mt-1 space-y-3">
            {expectedLiveUrl && (
              <p className="truncate text-xs text-zinc-500" title={expectedLiveUrl}>
                {isPublished ? "Live at" : "Will publish to"}{" "}
                <span className="text-zinc-300">{expectedLiveUrl}</span>
              </p>
            )}

            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="NetApp SSO password"
                  value={sshPassword}
                  onChange={(event) => setSshPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-describedby={`publish-hint-${prototype.id}`}
                  className="pr-12"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && sshPassword.trim()) publish();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <p id={`publish-hint-${prototype.id}`} className="text-xs leading-relaxed text-zinc-500">
                VPN or Zscaler (@netapp.com). Use your NetApp SSO password - not your Mac login.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={publish}
              disabled={publishing || opening || deleting || !sshPassword.trim()}
            >
              {publishing ? "Publishing…" : isPublished ? "Republish" : "Publish"}
            </Button>
          </div>
        )}

        {actionError && <p className="text-xs text-red-300">{actionError}</p>}

        {showOwnerTools && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
            <IconButton
              label={pathCopied ? "Path copied" : "Open folder on Desktop"}
              onClick={showFolder}
              disabled={opening || publishing || deleting}
            >
              <FolderIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              label="Continue building"
              onClick={continueBuilding}
              disabled={opening || publishing || deleting}
            >
              <CodeIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              label="Remove from Proto Hub"
              tone="danger"
              onClick={remove}
              disabled={deleting || publishing || opening}
              className="ml-auto"
            >
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>
    </Card>
  );
}
