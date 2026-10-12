import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDesktopPath } from "@/lib/paths";
import { canPickFolder } from "@/lib/pick-folder";
import { templateHasBundledBlueprint } from "@/lib/setup";

function checkFolderPath(raw: string | null) {
  const value = (raw || "").trim();
  if (!value) return null;

  const resolved = path.resolve(value);
  const home = path.resolve(process.env.HOME || "");
  if (!home || (!resolved.startsWith(`${home}${path.sep}`) && resolved !== home)) {
    return { path: resolved, exists: false, error: "path must be under your home folder" };
  }

  const exists = fs.existsSync(resolved);
  return {
    path: resolved,
    exists,
    message: exists ? `A folder already exists at: ${resolved}` : null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderCheck = checkFolderPath(searchParams.get("path"));

  return NextResponse.json({
    desktopPath: getDesktopPath(),
    canPickFolder: canPickFolder(),
    blueprintBundled: templateHasBundledBlueprint(),
    folderCheck,
  });
}
