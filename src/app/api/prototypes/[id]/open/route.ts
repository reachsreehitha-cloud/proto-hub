import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import { prototypeFolderPresent } from "@/lib/preview";
import { openInEditor } from "@/lib/scaffold";
import { getPrototype } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can open this prototype in an editor." }, { status: 403 });
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

  // Cursor-only for now (ignore stored "claude" from older drafts)
  const opened = openInEditor(prototype.folderPath, "cursor");
  if (!opened) {
    return NextResponse.json(
      {
        // RESTORE: `prototype.editor === "claude" ? "Claude" : "Cursor"`
        error: "Could not open Cursor. Open the folder manually.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
