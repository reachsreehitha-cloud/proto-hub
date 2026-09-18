import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import { publishPrototypeToUx } from "@/lib/publish";
import { getPrototype, publishPrototype } from "@/lib/store";
import { upsertLocalRegistry } from "@/lib/teamRegistry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can publish this prototype." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const username = user.accountId;

  if (!username) {
    return NextResponse.json({ error: "Could not determine your NetApp account." }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json(
      { error: "Enter your NetApp SSO password to publish." },
      { status: 400 },
    );
  }

  const hubBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const hubReviewUrl = `${hubBase}/review/${prototype.id}`;

  try {
    const result = await publishPrototypeToUx(
      prototype.folderPath,
      prototype.name,
      hubReviewUrl,
      { username, password },
      prototype.slug,
    );
    const updated = publishPrototype(prototype.id, result.previewUrl);
    if (updated) {
      upsertLocalRegistry(updated);
    }
    return NextResponse.json({
      prototype: updated,
      previewUrl: result.previewUrl,
      shareUrl: result.shareUrl,
      teamRegistryUpdated: true,
      teamShareHint:
        "Added to data/team-registry.json. Commit and push so teammates see it in Team gallery.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
