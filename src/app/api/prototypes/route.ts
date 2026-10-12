import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkPrerequisites, firstBlockerMessage } from "@/lib/prerequisites";
import { allocateLocalPort, prototypeFolderPresent } from "@/lib/preview";
import { createPrototypeRecord, getPrototypes } from "@/lib/store";
import { scaffoldPrototype } from "@/lib/scaffold";
import type { CreatePrototypeInput } from "@/lib/types";

export async function GET() {
  const prototypes = getPrototypes().map((prototype) => ({
    ...prototype,
    folderMissing:
      !prototype.fromRegistry && !prototypeFolderPresent(prototype.folderPath),
  }));
  return NextResponse.json({ prototypes });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePrototypeInput;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Prototype name is required." }, { status: 400 });
    }

    const user = getCurrentUser();
    // Cursor-only for now. RESTORE: `body.editor ?? "cursor"`
    const editor = "cursor" as const;
    const prerequisites = checkPrerequisites(editor);
    const blocker = firstBlockerMessage(prerequisites);
    if (blocker) {
      return NextResponse.json(
        { error: blocker, prerequisites },
        { status: 400 },
      );
    }

    const localPort = allocateLocalPort(getPrototypes());
    const result = scaffoldPrototype(
      body.name.trim(),
      body.folderPath,
      editor,
      localPort,
    );

    const prototype = createPrototypeRecord(
      {
        name: body.name.trim(),
        description: body.description?.trim(),
        author: user.name,
        authorEmail: user.email,
        folderPath: result.folderPath,
        editor: result.editor,
      },
      result.folderPath,
      { localPort },
    );

    return NextResponse.json(
      {
        prototype,
        scaffold: {
          folderPath: result.folderPath,
          installStatus: result.installStatus,
          installMessage: result.installMessage,
          installHelpUrl: result.installHelpUrl,
          opened: result.opened,
          editor: result.editor,
          localPort: result.localPort ?? localPort,
          localPreviewUrl: result.localPreviewUrl,
          previewStarted: result.previewStarted,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create prototype";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
