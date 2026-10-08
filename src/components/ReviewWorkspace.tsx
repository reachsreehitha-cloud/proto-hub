"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, Textarea } from "./ui";
import { WatchToggle } from "./WatchToggle";
import type { Comment, Prototype } from "@/lib/types";

function renderBody(body: string) {
  return body.replace(
    /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g,
    '<span class="text-violet-300">@$1</span>',
  );
}

export function ReviewWorkspace({ prototypeId }: { prototypeId: string }) {
  const [prototype, setPrototype] = useState<Prototype | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("/home");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [commentMode, setCommentMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [prototypeRes, commentsRes] = await Promise.all([
      fetch(`/api/prototypes/${prototypeId}`),
      fetch(`/api/prototypes/${prototypeId}/comments`),
    ]);
    const prototypeData = await prototypeRes.json();
    const commentsData = await commentsRes.json();
    setPrototype(prototypeData.prototype);
    setComments(commentsData.comments ?? []);
    const proto = prototypeData.prototype;
    setPreviewUrl(proto?.previewUrl || "http://localhost:5173/#/home");
    if (proto?.status === "published") {
      setShareUrl(`${window.location.origin}/review/${proto.id}`);
    }
  }, [prototypeId]);

  useEffect(() => {
    load();
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setAuthor(data.user?.name ?? "");
        setAuthorEmail(data.user?.email ?? "");
      });
    const params = new URLSearchParams(window.location.search);
    const commentId = params.get("comment");
    const routeParam = params.get("route");
    if (routeParam) setRoute(routeParam);
    if (commentId) setActiveCommentId(commentId);
    if (params.get("mode") === "comment") setCommentMode(true);
  }, [load]);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      const routeMatch = comment.route === route || route === "all";
      const statusMatch = statusFilter === "all" || comment.status === statusFilter;
      return routeMatch && statusMatch;
    });
  }, [comments, route, statusFilter]);

  const pinComments = filteredComments.filter((c) => !c.parentId);

  async function submitComment() {
    if (!body.trim() || !author.trim() || !authorEmail.trim()) return;
    const res = await fetch(`/api/prototypes/${prototypeId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        author,
        authorEmail,
        route,
        x: pendingPin?.x ?? 50,
        y: pendingPin?.y ?? 50,
      }),
    });
    if (res.ok) {
      setBody("");
      setPendingPin(null);
      setCommentMode(false);
      await load();
    }
  }

  async function publishPrototype() {
    setPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    try {
      const res = await fetch(`/api/prototypes/${prototypeId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setPreviewUrl(data.previewUrl);
      setShareUrl(data.shareUrl);
      setPublishSuccess(
        data.previewUrl
          ? `Published successfully. Live at ${data.previewUrl}`
          : "Published successfully.",
      );
      await load();
    } catch (err) {
      setPublishSuccess("");
      setPublishError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  function copyShareLink() {
    const url = shareUrl || `${window.location.origin}/review/${prototypeId}`;
    navigator.clipboard.writeText(url);
  }

  async function resolveComment(id: string, status: Comment["status"]) {
    await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  function copyDeepLink(comment: Comment) {
    const url = new URL(window.location.href);
    url.searchParams.set("comment", comment.id);
    url.searchParams.set("route", comment.route);
    navigator.clipboard.writeText(url.toString());
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!commentMode || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
  }

  if (!prototype) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">Loading review...</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-zinc-400 hover:text-white">← Dashboard</Link>
            <div>
              <h1 className="text-lg font-medium">{prototype.name}</h1>
              <p className="text-xs text-zinc-500">
                {prototype.author} · {prototype.status === "published" ? "In team gallery" : "Draft · only author sees this"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <WatchToggle prototypeId={prototype.id} variant="button" />
            <Button variant="outline" onClick={publishPrototype} disabled={publishing}>
              {publishing ? "Publishing…" : prototype.status === "published" ? "Republish" : "Publish"}
            </Button>
            {prototype.status === "published" && (
              <Button variant="ghost" onClick={copyShareLink}>Copy team link</Button>
            )}
            <Button variant={commentMode ? "primary" : "outline"} onClick={() => setCommentMode((v) => !v)}>
              {commentMode ? "Click to pin" : "Add comment"}
            </Button>
          </div>
        </header>

        {publishError && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-sm text-red-300">{publishError}</div>
        )}

        {publishSuccess && (
          <div
            className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-sm text-emerald-100"
            role="status"
            aria-live="polite"
          >
            {publishSuccess}
          </div>
        )}

        {prototype.status === "published" && shareUrl && (
          <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-sm text-emerald-100">
            Live at <a href={previewUrl} className="underline" target="_blank" rel="noreferrer">{previewUrl}</a>
            · Share <button type="button" onClick={copyShareLink} className="underline">{shareUrl}</button> with your team
          </div>
        )}

        <div className="border-b border-white/10 px-5 py-3 text-sm text-zinc-400">
          Reviewing screen: <span className="text-white">{route}</span>
          <span className="mx-3">·</span>
          Share this exact view with teammates using the link icon on any comment.
        </div>

        <div
          ref={frameRef}
          className={`relative flex-1 bg-zinc-900 ${commentMode ? "cursor-crosshair" : ""}`}
          onClick={handleCanvasClick}
        >
          <iframe
            title={prototype.name}
            src={previewUrl}
            className="h-full w-full border-0 bg-white"
            onLoad={() => {
              try {
                const hash = new URL(previewUrl).hash.replace(/^#/, "");
                if (hash) setRoute(hash.startsWith("/") ? hash : `/${hash}`);
              } catch {
                // ignore invalid preview URL during editing
              }
            }}
          />

          {pinComments.map((comment, index) => (
            <button
              key={comment.id}
              style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-2 py-1 text-xs font-semibold transition ${
                activeCommentId === comment.id
                  ? "border-violet-300 bg-violet-500 text-white"
                  : "border-white bg-violet-600 text-white hover:scale-110"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCommentId(comment.id);
              }}
            >
              {index + 1}
            </button>
          ))}

          {pendingPin && (
            <div
              style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-violet-300 bg-violet-500/80 px-2 py-1 text-xs"
            >
              New
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-[380px] flex-col border-l border-white/10 bg-zinc-950">
        <div className="border-b border-white/10 p-4">
          <div className="mb-3 flex gap-2">
            {(["all", "open", "resolved"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  statusFilter === value ? "bg-white text-black" : "bg-white/5 text-zinc-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Route filter e.g. /dashboard" />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredComments.length === 0 ? (
            <p className="text-sm text-zinc-500">No comments on this screen yet.</p>
          ) : (
            filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={`rounded-2xl border p-4 ${
                  activeCommentId === comment.id ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{comment.author}</p>
                    <p className="text-xs text-zinc-500">{comment.route}</p>
                  </div>
                  <Badge tone={comment.status === "resolved" ? "success" : "warning"}>{comment.status}</Badge>
                </div>
                <p className="text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: renderBody(comment.body) }} />
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => copyDeepLink(comment)}>
                    Copy link
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                    onClick={() => resolveComment(comment.id, comment.status === "open" ? "resolved" : "open")}
                  >
                    {comment.status === "open" ? "Resolve" : "Reopen"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          <p className="mb-3 text-sm text-zinc-400">
            {pendingPin ? "Pinned. Write your comment below." : commentMode ? "Click the prototype to place a pin." : "Enable comment mode to add feedback."}
          </p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave feedback. Use @email@netapp.com to notify. Watching also emails you (Unsubscribe in the header)."
            rows={4}
          />
          <Button className="mt-3 w-full" onClick={submitComment} disabled={!body.trim()}>
            Post comment
          </Button>
        </div>
      </aside>
    </div>
  );
}
