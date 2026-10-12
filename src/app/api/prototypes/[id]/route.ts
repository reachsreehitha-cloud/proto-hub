import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import {
  deletePrototype,
  getPrototype,
  getPrototypes,
  markFolderUnlinked,
  publishPrototype,
  updatePrototype,
} from "@/lib/store";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }
  return NextResponse.json({ prototype });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can update this prototype." }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "publish") {
    const previewUrl = body.previewUrl || prototype.previewUrl || `http://localhost:5173/#/home`;
    const updated = publishPrototype(prototype.id, previewUrl);
    return NextResponse.json({ prototype: updated });
  }

  if (typeof body.slug === "string") {
    if (prototype.status === "published") {
      return NextResponse.json(
        { error: "URL name is locked after publish. Create a new draft to use a different name." },
        { status: 400 },
      );
    }
    const slug = slugify(body.slug);
    if (!slug) {
      return NextResponse.json({ error: "URL name is required." }, { status: 400 });
    }
    const taken = getPrototypes().some((p) => p.id !== prototype.id && p.slug === slug);
    if (taken) {
      return NextResponse.json({ error: "That URL name is already used. Pick another." }, { status: 400 });
    }
    // Slug is the live URL segment only - Desktop folder path is never renamed.
    const updated = updatePrototype(prototype.id, { slug });
    return NextResponse.json({ prototype: updated });
  }

  if (typeof body.commentsEnabled === "boolean") {
    const { registerSiteAdmin, setLiveCommentsEnabled, getCommenterBaseUrl, injectCommenterScript } =
      await import("@/lib/commenterInject");
    const { pushCommentsSettingToUx } = await import("@/lib/publish");
    const path = await import("node:path");
    const fs = await import("node:fs");

    const updated = updatePrototype(prototype.id, { commentsEnabled: body.commentsEnabled });

    let siteId = "";
    if (typeof body.liveSiteId === "string" && body.liveSiteId.trim()) {
      siteId = body.liveSiteId.trim().replace(/^\/+/, "");
    } else {
      const live = updated?.previewUrl || "";
      const match = live.match(/\/~([^/]+)\/([^/]+)/);
      if (match) siteId = `~${match[1]}/${match[2]}`;
    }

    // Keep local dist meta in sync for the next publish even if we cannot push now.
    try {
      const localDist = path.join(prototype.folderPath, "dist");
      if (fs.existsSync(path.join(localDist, "index.html"))) {
        injectCommenterScript(localDist, getCommenterBaseUrl(), {
          enabled: body.commentsEnabled,
        });
      }
    } catch {
      // best-effort
    }

    const password = typeof body.password === "string" ? body.password.trim() : "";
    const usernameRaw =
      typeof body.username === "string" && body.username.trim()
        ? body.username.trim()
        : user.accountId;

    // Published site: push HTML meta to ux.netapp.com so the bubble actually hides/shows.
    if (prototype.status === "published" && password && siteId) {
      try {
        await pushCommentsSettingToUx(
          prototype.folderPath,
          prototype.name,
          { username: usernameRaw, password },
          prototype.slug,
          body.commentsEnabled,
        );
        return NextResponse.json({
          prototype: updated,
          siteId,
          liveUpdated: true,
          hint: body.commentsEnabled
            ? "Comments on. Live page updated. Hard-refresh the link if the bubble still shows."
            : "Comments off. Live page updated. Hard-refresh the link (⌘⇧R) if the bubble still shows.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update live page";
        return NextResponse.json({
          prototype: updated,
          siteId,
          liveUpdated: false,
          needsRepublish: true,
          hint: `Saved in Proto Hub. Republish to apply on the live link. (${message})`,
        }, { status: 200 });
      }
    }

    if (siteId) {
      const ownerLdap = siteId.startsWith("~")
        ? siteId.slice(1).split("/")[0]
        : user.accountId;
      await registerSiteAdmin({
        commenterBaseUrl: getCommenterBaseUrl(),
        siteId,
        ldap: ownerLdap,
        email: user.email,
        name: user.name,
      });
      const sync = await setLiveCommentsEnabled({
        commenterBaseUrl: getCommenterBaseUrl(),
        siteId,
        enabled: body.commentsEnabled,
        ownerLdap,
      });

      if (prototype.status === "published") {
        return NextResponse.json({
          prototype: updated,
          siteId,
          liveUpdated: false,
          needsRepublish: true,
          syncOk: sync.ok,
          hint: body.commentsEnabled
            ? "Saved. Republish once to show the comment bubble on the live link."
            : "Saved. Republish once to hide the comment bubble on the live link.",
        });
      }
    }

    return NextResponse.json({
      prototype: updated,
      siteId: siteId || null,
      hint: body.commentsEnabled
        ? "Comments on. They will be included when you publish."
        : "Comments off. They will stay off when you publish.",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getCurrentUser();
  const prototype = getPrototype(id);

  const url = new URL(request.url);
  const deleteFolder =
    url.searchParams.get("deleteFolder") === "1" ||
    url.searchParams.get("deleteFolder") === "true";

  // Gallery-only registry card with no local draft. Remove listing if owned
  if (!prototype) {
    const { readLocalRegistry, removeFromLocalRegistry } = await import("@/lib/teamRegistry");
    const entry = readLocalRegistry().find((e) => e.id === id);
    if (!entry || entry.authorEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
    }
    removeFromLocalRegistry({ id: entry.id });
    return NextResponse.json({ ok: true, listingRemoved: true, folderDeleted: false });
  }

  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can delete this prototype." }, { status: 403 });
  }

  let folderResult: { ok: boolean; message?: string } | undefined;
  if (deleteFolder && prototype.folderPath && !prototype.fromRegistry) {
    const { movePrototypeFolderToTrash, stopPreviewOnPort } = await import("@/lib/deleteFolder");
    stopPreviewOnPort(prototype.localPort);
    folderResult = movePrototypeFolderToTrash(prototype.folderPath);
    if (!folderResult.ok) {
      return NextResponse.json(
        { error: folderResult.message || "Could not delete Desktop folder." },
        { status: 500 },
      );
    }
  }

  // Always remove from Proto Hub list; optional Desktop folder via checkbox
  if (!deleteFolder) {
    markFolderUnlinked(prototype.folderPath);
  }
  const removed = deletePrototype(prototype.id);
  if (!removed) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const { removeFromLocalRegistry } = await import("@/lib/teamRegistry");
  removeFromLocalRegistry({
    id: `registry-${prototype.authorEmail.split("@")[0]}-${prototype.slug}`,
    previewUrl: prototype.previewUrl,
    authorEmail: prototype.authorEmail,
    slug: prototype.slug,
  });

  return NextResponse.json({
    ok: true,
    folderDeleted: Boolean(deleteFolder && folderResult?.ok),
    listingRemoved: true,
    folderMessage: folderResult?.message,
  });
}
