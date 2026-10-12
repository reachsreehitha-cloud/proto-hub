import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import {
  isPreviewReachable,
  localPreviewUrlForPort,
  prototypeFolderPresent,
  startLocalPreview,
  waitUntilPreviewReady,
  writeDevPort,
} from "@/lib/preview";
import { getPrototype, savePrototype } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can start this preview." }, { status: 403 });
  }

  if (!prototypeFolderPresent(prototype.folderPath)) {
    return NextResponse.json(
      {
        error:
          "Folder missing. This draft’s Desktop folder was deleted. Remove it from Proto Hub, or Create again.",
        folderMissing: true,
      },
      { status: 404 },
    );
  }

  const port = prototype.localPort ?? 5173;
  const url = prototype.localPreviewUrl || localPreviewUrlForPort(port);

  // Keep package.json port in sync with the hub registry (older drafts drift).
  try {
    writeDevPort(prototype.folderPath, port);
    if (!prototype.localPreviewUrl || prototype.localPort !== port) {
      savePrototype({
        ...prototype,
        localPort: port,
        localPreviewUrl: url,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Best-effort. Still try to start
  }

  if (await isPreviewReachable(url)) {
    return NextResponse.json({ ok: true, alreadyRunning: true, url });
  }

  const result = startLocalPreview(prototype.folderPath, port);
  if (!result.started) {
    return NextResponse.json(
      { error: result.reason || "Could not start preview" },
      { status: 500 },
    );
  }

  // First wait (Vite usually up in a few seconds after bin repair)
  let ready = await waitUntilPreviewReady(url, { timeoutMs: 20000, intervalMs: 400 });
  if (!ready) {
    // One more start attempt (first spawn may have died on a broken .bin)
    startLocalPreview(prototype.folderPath, port);
    ready = await waitUntilPreviewReady(url, { timeoutMs: 15000, intervalMs: 400 });
  }

  if (!ready) {
    return NextResponse.json(
      {
        error:
          "Preview could not start on this draft (often a broken Vite install under OneDrive). Try Open preview again, or Open in Cursor and ask it to fix blueprint-app preview.",
        url,
      },
      { status: 504 },
    );
  }

  return NextResponse.json({ ok: true, alreadyRunning: false, url });
}
