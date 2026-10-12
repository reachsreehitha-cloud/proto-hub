import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * Check whether a proposed prototype folder already exists on disk.
 * Used by Create flow so conflicts show on step 1, not after Create fails.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("path") || "").trim();
  if (!raw) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const resolved = path.resolve(raw);
  // Only allow checking under the user's home (Create always targets Desktop / home).
  const home = path.resolve(process.env.HOME || "");
  if (!home || (!resolved.startsWith(`${home}${path.sep}`) && resolved !== home)) {
    return NextResponse.json({ error: "path must be under your home folder" }, { status: 400 });
  }

  const exists = fs.existsSync(resolved);
  return NextResponse.json({
    path: resolved,
    exists,
    message: exists ? `A folder already exists at: ${resolved}` : null,
  });
}
