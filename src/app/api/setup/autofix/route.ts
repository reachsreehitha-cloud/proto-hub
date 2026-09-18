import { NextResponse } from "next/server";
import { autoSetupEnvironment, templateHasBundledBlueprint } from "@/lib/setup";

export async function POST() {
  const result = autoSetupEnvironment();
  return NextResponse.json({
    ...result,
    blueprintBundled: templateHasBundledBlueprint(),
  });
}
