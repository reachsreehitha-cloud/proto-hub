import { NextResponse } from "next/server";
import { autoSetupEnvironment, templateHasBundledBlueprint } from "@/lib/setup";
import { resolveNode, resolveNpm } from "@/lib/runtimePath";

export async function POST() {
  const result = autoSetupEnvironment();
  return NextResponse.json({
    ...result,
    blueprintBundled: templateHasBundledBlueprint(),
    nodePath: resolveNode(),
    npmPath: resolveNpm(),
  });
}
