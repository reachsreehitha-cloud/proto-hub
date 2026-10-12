"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PrototypeCover } from "./PrototypeCover";
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  FolderIcon,
  TrashIcon,
} from "./icons";
import { PublishGuideDialog } from "./PublishGuideDialog";
import { Button, Card, IconButton, Input } from "./ui";
import { WatchToggle } from "./WatchToggle";
import { CommentsEnabledToggle } from "./CommentsEnabledToggle";
import type { Prototype } from "@/lib/types";
import { isSharedLocalPreview } from "@/lib/coverPlaceholder";
import { UX_HOST } from "@/lib/publishGuide";

const OPENLAB_USER_KEY = "proto-hub-openlab-username";

/** Leftover ids from demos / docs examples. Never treat these as your OpenLab id. */
const STALE_OPENLAB_IDS = /^(dyland|dylan|jane|test\d*|user|admin|demo|example)$/i;

function authorLabel(prototype: Prototype, isOwn: boolean) {
  if (isOwn) return "You";
  return prototype.author?.trim() || prototype.authorEmail.split("@")[0] || "Someone";
}

/**
 * Prefer Mac login (accountId, e.g. sb29895). Only keep a stored override when it
 * looks like a real id and is not a known test placeholder.
 */
function readStoredUsername(fallback: string) {
  if (typeof window === "undefined") return fallback;
  const macId = fallback.trim().toLowerCase();
  try {
    const stored = localStorage.getItem(OPENLAB_USER_KEY)?.trim().toLowerCase() || "";
    if (!stored || STALE_OPENLAB_IDS.test(stored)) {
      if (stored) localStorage.removeItem(OPENLAB_USER_KEY);
      return macId || fallback;
    }
    // Mac login is the default source of truth after mistaken test publishes
    if (macId && stored !== macId) {
      localStorage.removeItem(OPENLAB_USER_KEY);
      return macId;
    }
    return stored;
  } catch {
    return macId || fallback;
  }
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
  onPublished,
}: {
  prototype: Prototype;
  isOwn: boolean;
  /** Team gallery: same layout for every card - no owner publish/edit chrome. */
  galleryMode?: boolean;
  accountId?: string;
  onRefresh: () => void;
  onPublished?: (info: {
    name: string;
    liveUrl: string;
    commentsInjected: boolean;
  }) => void;
}) {
  const isPublished = prototype.status === "published";
  /** Full draft/publish chrome (not on Team gallery cards). */
  const showOwnerTools = isOwn && !galleryMode;
  /** Comments on/off for live ux.netapp.com (drafts before publish + published). */
  const showCommentsToggle = isOwn && (showOwnerTools || isPublished);
  /** Delete your own cards everywhere, including Team gallery. */
  const showDelete = isOwn;
  const guessedUser = accountId || prototype.authorEmail.split("@")[0] || "";
  const [publishing, setPublishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alsoDeleteDesktop, setAlsoDeleteDesktop] = useState(false);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [sshPassword, setSshPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [teamShareHint, setTeamShareHint] = useState("");
  const [openLabUsername, setOpenLabUsername] = useState(guessedUser);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState("");
  const [publishGuideOpen, setPublishGuideOpen] = useState(false);
  const [publishPhase, setPublishPhase] = useState<"confirm" | "publishing" | "done">("confirm");
  const [publishedLiveUrl, setPublishedLiveUrl] = useState("");
  const [commentsOn, setCommentsOn] = useState(prototype.commentsEnabled !== false);

  useEffect(() => {
    setOpenLabUsername(readStoredUsername(guessedUser));
  }, [guessedUser]);

  useEffect(() => {
    setCommentsOn(prototype.commentsEnabled !== false);
  }, [prototype.commentsEnabled, prototype.id]);

  const publishUsername = openLabUsername.trim().toLowerCase() || guessedUser;
  const expectedLiveUrl = publishUsername
    ? `https://${UX_HOST}/~${publishUsername}/${prototype.slug}/`
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

  /**
   * Start Vite for this draft’s port, wait until it answers, then open that URL.
   * “Opening…” forever usually means Vite never came up (broken .bin under OneDrive)
   * or the browser opened the wrong port (shared 5173 vs this card’s port).
   */
  async function openLocalPreview() {
    setOpeningPreview(true);
    setPreviewStatus("Starting…");
    setActionError("");
    const cardUrl =
      prototype.localPreviewUrl ||
      (typeof prototype.localPort === "number"
        ? `http://localhost:${prototype.localPort}/#/home`
        : "");
    const controller = new AbortController();
    const kill = window.setTimeout(() => controller.abort(), 55000);
    const statusTimer = window.setTimeout(() => setPreviewStatus("Waiting…"), 4000);
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}/start-preview`, {
        method: "POST",
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      const apiUrl = typeof data.url === "string" ? data.url : "";
      const url =
        apiUrl &&
        (!prototype.localPort || apiUrl.includes(`:${prototype.localPort}`))
          ? apiUrl
          : cardUrl;

      if (!res.ok) {
        // Still surface the draft URL so designers aren’t stuck on a blank “Opening…”
        if (url && (res.status === 504 || data.url)) {
          setActionError(
            `${typeof data.error === "string" ? data.error : "Preview not ready."} Try ${url}`,
          );
        } else {
          throw new Error(
            typeof data.error === "string" ? data.error : "Could not start preview",
          );
        }
        return;
      }

      if (!url) throw new Error("No local preview URL for this draft");
      setPreviewStatus("Opening…");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setActionError(
          cardUrl
            ? `Preview timed out on port ${prototype.localPort ?? "?"}. Open ${cardUrl} or try again.`
            : "Preview timed out. Try Open preview again.",
        );
      } else {
        setActionError(err instanceof Error ? err.message : "Could not open preview");
      }
    } finally {
      window.clearTimeout(kill);
      window.clearTimeout(statusTimer);
      setOpeningPreview(false);
      setPreviewStatus("");
    }
  }

  async function setCommentsEnabled(next: boolean) {
    setCommentsOn(next);
    try {
      const res = await fetch(`/api/prototypes/${prototype.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentsEnabled: next,
          liveSiteId:
            isPublished && publishUsername && prototype.slug
              ? `~${publishUsername}/${prototype.slug}`
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update comments");
      if (typeof data.hint === "string") setTeamShareHint(data.hint);
      onRefresh();
    } catch (err) {
      setCommentsOn(prototype.commentsEnabled !== false);
      setActionError(err instanceof Error ? err.message : "Could not update comments");
    }
  }

  function openPublishGuide() {
    setActionError("");
    if (!publishUsername.trim()) {
      setActionError("Enter your short NetApp username (OpenLab id).");
      return;
    }
    if (!sshPassword.trim()) {
      setActionError("Enter your NetApp SSO password to publish.");
      return;
    }
    setCommentsOn(prototype.commentsEnabled !== false);
    setPublishPhase("confirm");
    setPublishedLiveUrl("");
    setPublishGuideOpen(true);
  }

  async function publish() {
    if (!publishUsername.trim()) {
      setActionError("Enter your short NetApp username (OpenLab id).");
      setPublishPhase("confirm");
      return;
    }
    if (!sshPassword.trim()) {
      setActionError("Enter your NetApp SSO password to publish.");
      setPublishPhase("confirm");
      return;
    }

    setPublishing(true);
    setPublishPhase("publishing");
    setActionError("");
    setPublishSuccess("");
    setTeamShareHint("");
    try {
      try {
        localStorage.setItem(OPENLAB_USER_KEY, publishUsername.trim().toLowerCase());
      } catch {
        // ignore
      }

      const res = await fetch(`/api/prototypes/${prototype.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sshPassword,
          username: publishUsername.trim().toLowerCase(),
          commentsEnabled: commentsOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setSshPassword("");
      const url =
        typeof data.previewUrl === "string" && data.previewUrl
          ? data.previewUrl
          : expectedLiveUrl;
      setPublishedLiveUrl(url);
      const commentsInjected = Boolean(data.commentsInjected);
      setPublishSuccess(
        url
          ? `Published. Live at ${url}${commentsInjected ? ". Comments are on." : ""}`
          : "Published.",
      );
      if (typeof data.teamShareHint === "string") {
        setTeamShareHint(data.teamShareHint);
      }
      setPublishPhase("done");
      setPublishGuideOpen(true);
      // Do not refresh yet. Refreshing moves the card out of My drafts and
      // unmounts this success dialog before anyone can see it.
      onPublished?.({
        name: prototype.name,
        liveUrl: url,
        commentsInjected,
      });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Published to ux.netapp.com", {
            body: url || prototype.name,
          });
        } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {
        // ignore
      }
    } catch (err) {
      setPublishSuccess("");
      const message = err instanceof Error ? err.message : "Publish failed";
      setActionError(message);
      setPublishPhase("confirm");
      setPublishGuideOpen(true);
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

  function openLive() {
    if (!liveUrl) {
      setActionError("No live link yet - publish first.");
      return;
    }
    window.open(liveUrl, "_blank", "noopener,noreferrer");
  }

  const canDeleteDesktop =
    Boolean(prototype.folderPath) && !prototype.fromRegistry && !prototype.folderMissing;

  async function remove() {
    setDeleting(true);
    setActionError("");
    try {
      const qs =
        alsoDeleteDesktop && canDeleteDesktop ? "?deleteFolder=1" : "";
      const res = await fetch(`/api/prototypes/${prototype.id}${qs}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setConfirmDelete(false);
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

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {prototype.description || "No description yet."}
        </p>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-zinc-300">
            By <span className="font-medium text-white">{authorLabel(prototype, isOwn)}</span>
          </p>
          {/* Bell = your inbox only. Hidden for owners (already notified). Not the live-page bubble. */}
          <WatchToggle
            prototypeId={prototype.id}
            variant="icon"
            hideForOwner={isOwn}
          />
        </div>

        {!isOwn && prototype.commentsEnabled === false && (
          <p className="text-xs text-zinc-500">Comments off on the live page</p>
        )}

        {isPublished && liveUrl && (
          <div className="flex items-center gap-1">
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {liveUrl}
            </a>
            <IconButton label="Open live prototype" onClick={openLive} className="h-9 w-9 shrink-0">
              <ExternalLinkIcon className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={linkCopied ? "Link copied" : "Copy link"}
              onClick={copyLiveLink}
              className="h-9 w-9 shrink-0"
              aria-live="polite"
            >
              <CopyIcon className="h-4 w-4" />
            </IconButton>
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
              <Input
                value={openLabUsername}
                onChange={(event) => setOpenLabUsername(event.target.value)}
                placeholder={guessedUser || "your OpenLab id"}
                autoComplete="username"
                aria-label="OpenLab username"
              />
              {guessedUser ? (
                <p className="text-xs text-zinc-500">
                  Defaults to your Mac login ({guessedUser}).
                </p>
              ) : null}
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
                    if (event.key === "Enter" && sshPassword.trim() && publishUsername.trim()) {
                      openPublishGuide();
                    }
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
                OpenLab id + NetApp password. VPN required.
              </p>
            </div>

            {showCommentsToggle && (
              <CommentsEnabledToggle
                prototypeId={prototype.id}
                enabled={prototype.commentsEnabled !== false}
                isPublished={isPublished}
                password={sshPassword}
                username={publishUsername}
                liveSiteId={
                  isPublished && publishUsername && prototype.slug
                    ? `~${publishUsername}/${prototype.slug}`
                    : undefined
                }
                onUpdated={onRefresh}
                onHint={setTeamShareHint}
                onError={setActionError}
              />
            )}

            <Button
              className="w-full"
              onClick={openPublishGuide}
              disabled={publishing || opening || deleting || !sshPassword.trim() || !publishUsername.trim()}
            >
              {publishing ? "Publishing…" : isPublished ? "Republish" : "Publish"}
            </Button>
          </div>
        )}

        {/* Own published cards in Team gallery (no publish chrome) still need the comments switch */}
        {showCommentsToggle && !showOwnerTools && (
          <CommentsEnabledToggle
            prototypeId={prototype.id}
            enabled={prototype.commentsEnabled !== false}
            isPublished={isPublished}
            liveSiteId={
              publishUsername && prototype.slug
                ? `~${publishUsername}/${prototype.slug}`
                : undefined
            }
            onUpdated={onRefresh}
            onHint={setTeamShareHint}
            onError={setActionError}
          />
        )}

        {actionError && <p className="text-xs text-red-300">{actionError}</p>}
        {publishSuccess && (
          <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" role="status" aria-live="polite">
            {publishSuccess}
          </p>
        )}
        {teamShareHint && <p className="text-xs text-emerald-300/90">{teamShareHint}</p>}

        {showOwnerTools && prototype.folderMissing && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Desktop folder is gone. Remove this card from Proto Hub, or Create the project again.
          </div>
        )}

        {(showOwnerTools || showDelete) && (
          <div className="mt-auto space-y-3 border-t border-white/5 pt-3">
            {showOwnerTools && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  onClick={continueBuilding}
                  disabled={
                    opening ||
                    openingPreview ||
                    publishing ||
                    deleting ||
                    Boolean(prototype.folderMissing)
                  }
                >
                  {opening ? "Opening…" : "Open in Cursor"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void openLocalPreview()}
                  disabled={
                    opening ||
                    openingPreview ||
                    publishing ||
                    deleting ||
                    Boolean(prototype.folderMissing)
                  }
                >
                  {openingPreview ? previewStatus || "Starting…" : "Open preview"}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {showOwnerTools && (
                <IconButton
                  label={pathCopied ? "Path copied" : "Open folder on Desktop"}
                  onClick={showFolder}
                  disabled={
                    opening ||
                    openingPreview ||
                    publishing ||
                    deleting ||
                    Boolean(prototype.folderMissing)
                  }
                >
                  <FolderIcon className="h-4 w-4" />
                </IconButton>
              )}

              {showDelete && (
                <IconButton
                  label="Delete"
                  tone="danger"
                  onClick={() => {
                    setAlsoDeleteDesktop(false);
                    setActionError("");
                    setConfirmDelete(true);
                  }}
                  disabled={deleting || publishing || opening || openingPreview}
                  className="ml-auto"
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </div>
        )}
      </div>

      <PublishGuideDialog
        open={publishGuideOpen}
        phase={publishPhase}
        prototypeName={prototype.name}
        liveUrl={publishedLiveUrl || expectedLiveUrl || liveUrl}
        isRepublish={isPublished}
        error={publishPhase === "confirm" ? actionError : undefined}
        commentsEnabled={commentsOn}
        onCommentsEnabledChange={(next) => void setCommentsEnabled(next)}
        onClose={() => {
          if (publishPhase === "publishing") return;
          const wasDone = publishPhase === "done";
          setPublishGuideOpen(false);
          setPublishPhase("confirm");
          // Refresh after the success dialog is dismissed so the card can move
          // to My published without killing the “Published successfully” UI.
          if (wasDone) onRefresh();
        }}
        onConfirmPublish={() => void publish()}
      />

      {confirmDelete &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${prototype.id}`}
            onClick={(event) => {
              if (event.target === event.currentTarget && !deleting) setConfirmDelete(false);
            }}
          >
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <h2
                id={`delete-title-${prototype.id}`}
                className="text-xl font-semibold text-white"
              >
                Delete “{prototype.name}”?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Removes it from Proto Hub. The live {UX_HOST} link stays up if you already published.
              </p>

              {canDeleteDesktop && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={alsoDeleteDesktop}
                    disabled={deleting}
                    onChange={(event) => setAlsoDeleteDesktop(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <span>
                    <span className="font-medium text-white">Also delete the Desktop folder</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      The project files on your Mac. Leave unchecked to keep them.
                    </span>
                  </span>
                </label>
              )}

              {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button disabled={deleting} onClick={() => void remove()}>
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Card>
  );
}
