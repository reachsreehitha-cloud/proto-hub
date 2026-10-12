import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getPrototype,
  getWatchers,
  isWatching,
  unwatchPrototype,
  watchPrototype,
} from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  const watchers = getWatchers(prototype);
  return NextResponse.json({
    watching: isWatching(prototype, user.email),
    watcherCount: watchers.length,
    watchers,
  });
}

/** Start watching. Get emails when someone comments. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!user.email?.includes("@")) {
    return NextResponse.json({ error: "Sign in required to watch." }, { status: 401 });
  }

  const updated = watchPrototype(prototype.id, user.email);
  return NextResponse.json({
    prototype: updated,
    watching: true,
    watcherCount: getWatchers(updated!).length,
  });
}

/** Unsubscribe. Stop comment emails for this prototype. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const user = getCurrentUser();
  if (!user.email?.includes("@")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const updated = unwatchPrototype(prototype.id, user.email);
  return NextResponse.json({
    prototype: updated,
    watching: false,
    watcherCount: getWatchers(updated!).length,
  });
}
