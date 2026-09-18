import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser, isOwnPrototype } from "@/lib/auth";
import { getPrototype, removeCoverImage, updatePrototype } from "@/lib/store";

const COVERS_DIR = path.join(process.cwd(), "public", "covers");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function coverExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can set a cover image." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }

  fs.mkdirSync(COVERS_DIR, { recursive: true });
  removeCoverImage(prototype);

  const ext = coverExtension(file.type);
  const coverPath = `/covers/${prototype.id}.${ext}`;
  const absolutePath = path.join(process.cwd(), "public", coverPath.replace(/^\//, ""));
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(absolutePath, buffer);

  const updated = updatePrototype(prototype.id, {
    coverMode: "custom",
    coverImage: coverPath,
  });

  return NextResponse.json({ prototype: updated, coverImage: coverPath });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!isOwnPrototype(prototype, user)) {
    return NextResponse.json({ error: "Only the owner can change the cover." }, { status: 403 });
  }

  removeCoverImage(prototype);
  const updated = updatePrototype(prototype.id, {
    coverMode: "auto",
    coverImage: undefined,
  });

  return NextResponse.json({ prototype: updated });
}
