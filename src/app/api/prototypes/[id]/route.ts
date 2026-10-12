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
    const { registerSiteAdmin, setLiveCommentsEnabled, getCommenterBaseUrl } = await import(
      "@/lib/commenterInject"
    );
    const updated = updatePrototype(prototype.id, { commentsEnabled: body.commentsEnabled });

    let siteId = "";
    if (typeof body.liveSiteId === "string" && body.liveSiteId.trim()) {
      siteId = body.liveSiteId.trim().replace(/^\/+/, "");
    } else {
      const live = updated?.previewUrl || "";
      const match = live.match(/\/~([^/]+)\/([^/]+)/);
      if (match) siteId = `~${match[1]}/${match[2]}`;
    }

    if (siteId) {
      const ownerLdap = siteId.startsWith("~")
        ? siteId.slice(1).split("/")[0]
        : user.accountId;
      // Only the Proto Hub prototype owner reaches this PATCH (isOwnPrototype).
      await registerSiteAdmin({
        commenterBaseUrl: getCommenterBaseUrl(),
        siteId,
        ldap: ownerLdap,
        email: user.email,
        name: user.name,
      });
      await setLiveCommentsEnabled({
        commenterBaseUrl: getCommenterBaseUrl(),
        siteId,
        enabled: body.commentsEnabled,
        ownerLdap,
      });
    }

    return NextResponse.json({
      prototype: updated,
      siteId: siteId || null,
      hint: body.commentsEnabled
        ? "Live comments on. Only you (signed-in owner) can change this."
        : "Live comments off. Only you (signed-in owner) can turn them back on.",
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
