import { NextRequest, NextResponse } from "next/server";
import { checkPrerequisites } from "@/lib/prerequisites";
import type { EditorChoice } from "@/lib/types";

export async function GET(request: NextRequest) {
  const editor = request.nextUrl.searchParams.get("editor");
  const editorChoice =
    editor === "cursor" || editor === "claude" ? (editor as EditorChoice) : undefined;

  const report = checkPrerequisites(editorChoice);
  return NextResponse.json(report);
}
