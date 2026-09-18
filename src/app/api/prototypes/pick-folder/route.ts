import { NextResponse } from "next/server";
import { pickFolder, canPickFolder } from "@/lib/pick-folder";

export async function POST(request: Request) {
  if (!canPickFolder()) {
    return NextResponse.json(
      { error: "Folder picker is only available on macOS." },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const defaultPath = typeof body.defaultPath === "string" ? body.defaultPath : undefined;

  const folder = pickFolder(defaultPath);
  if (!folder) {
    return NextResponse.json({ cancelled: true });
  }

  return NextResponse.json({ folder });
}
