import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
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

  const opened = openInEditor(prototype.folderPath, prototype.editor ?? "cursor");
  if (!opened) {
    return NextResponse.json(
      { error: `Could not open ${prototype.editor === "claude" ? "Claude" : "Cursor"}. Open the folder manually.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
