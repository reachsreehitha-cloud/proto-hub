import fs from "node:fs";
import { execSync } from "node:child_process";
import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import { getPrototype } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can open this folder." }, { status: 403 });
  }

  if (!fs.existsSync(prototype.folderPath)) {
    return NextResponse.json({ error: "Folder not found on this machine." }, { status: 404 });
  }

  if (process.platform === "darwin") {
    try {
      execSync(`open "${prototype.folderPath}"`, { stdio: "pipe" });
      return NextResponse.json({ ok: true, folderPath: prototype.folderPath });
    } catch {
      return NextResponse.json({ error: "Could not open folder in Finder." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, folderPath: prototype.folderPath, opened: false });
}
