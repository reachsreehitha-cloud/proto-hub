import { NextResponse } from "next/server";
import { getDesktopPath } from "@/lib/paths";
import { canPickFolder } from "@/lib/pick-folder";
import { templateHasBundledBlueprint } from "@/lib/setup";

export async function GET() {
  return NextResponse.json({
    desktopPath: getDesktopPath(),
    canPickFolder: canPickFolder(),
    blueprintBundled: templateHasBundledBlueprint(),
  });
}
