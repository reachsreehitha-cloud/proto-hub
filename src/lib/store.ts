import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { allocateLocalPort, localPreviewUrlForPort, writeDevPort } from "./preview";
import type { Comment, CreateCommentInput, CreatePrototypeInput, Prototype } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROTOTYPES_FILE = path.join(DATA_DIR, "prototypes.json");
const COMMENTS_FILE = path.join(DATA_DIR, "comments.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson<T>(filePath: string, data: T) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function getPrototypes(): Prototype[] {
  const prototypes = readJson<Prototype[]>(PROTOTYPES_FILE, []);
  let changed = false;
  const used = new Set<number>();

  for (const prototype of prototypes) {
    if (typeof prototype.localPort === "number") used.add(prototype.localPort);
  }

  for (const prototype of prototypes) {
    if (typeof prototype.localPort === "number" && prototype.localPreviewUrl) {
      continue;
    }

    let port = 5173;
    while (used.has(port) && port < 5273) port++;
    used.add(port);

    prototype.localPort = port;
    prototype.localPreviewUrl = localPreviewUrlForPort(port);
    changed = true;

    if (prototype.folderPath && fs.existsSync(prototype.folderPath)) {
      try {
        writeDevPort(prototype.folderPath, port);
      } catch {
        // Folder may be incomplete - card still tracks the port
      }
    }
  }

  if (changed) writeJson(PROTOTYPES_FILE, prototypes);
  return prototypes;
}

export function getPrototype(id: string): Prototype | undefined {
  return getPrototypes().find((p) => p.id === id || p.slug === id);
}

export function removeCoverImage(prototype: Prototype) {
  if (!prototype.coverImage) return;
  const filePath = path.join(process.cwd(), "public", prototype.coverImage.replace(/^\//, ""));
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

export function savePrototype(prototype: Prototype) {
  const prototypes = getPrototypes();
  const index = prototypes.findIndex((p) => p.id === prototype.id);
  if (index >= 0) {
    prototypes[index] = prototype;
  } else {
    prototypes.unshift(prototype);
  }
  writeJson(PROTOTYPES_FILE, prototypes);
}

export function createPrototypeRecord(
  input: CreatePrototypeInput,
  folderPath: string,
  options?: { localPort?: number },
): Prototype {
  const now = new Date().toISOString();
  const baseSlug = slugify(input.name);
  const existing = getPrototypes();
  let slug = baseSlug || "prototype";
  let counter = 1;
  while (existing.some((p) => p.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const localPort = options?.localPort ?? allocateLocalPort(existing);
  const localPreviewUrl = localPreviewUrlForPort(localPort);

  const authorEmail = input.authorEmail.trim().toLowerCase();
  const prototype: Prototype = {
    id: randomUUID(),
    name: input.name,
    slug,
    description: input.description ?? "",
    author: input.author,
    authorEmail,
    previewUrl: "",
    folderPath: input.folderPath ?? folderPath,
    editor: input.editor,
    status: "draft",
    coverMode: "auto",
    localPort,
    localPreviewUrl,
    // Owner automatically watches their own prototype
    watchers: authorEmail.includes("@") ? [authorEmail] : [],
    createdAt: now,
    updatedAt: now,
  };

  savePrototype(prototype);
  return prototype;
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function getWatchers(prototype: Prototype): string[] {
  const list = Array.isArray(prototype.watchers) ? prototype.watchers : [];
  const author = normalizeEmail(prototype.authorEmail);
  const set = new Set(list.map(normalizeEmail).filter((e) => e.includes("@")));
  // Legacy records: treat owner as watching until they unsubscribe (empty array means unsubscribed)
  if (!Array.isArray(prototype.watchers) && author.includes("@")) {
    set.add(author);
  }
  return [...set];
}

export function isWatching(prototype: Prototype, email: string): boolean {
  const target = normalizeEmail(email);
  if (!target.includes("@")) return false;
  return getWatchers(prototype).includes(target);
}

export function watchPrototype(id: string, email: string): Prototype | undefined {
  const prototype = getPrototype(id);
  if (!prototype) return undefined;
  const target = normalizeEmail(email);
  if (!target.includes("@")) return prototype;

  const watchers = getWatchers(prototype);
  if (watchers.includes(target)) {
    // Ensure watchers field exists on legacy records
    if (!Array.isArray(prototype.watchers)) {
      return updatePrototype(id, { watchers });
    }
    return prototype;
  }
  return updatePrototype(id, { watchers: [...watchers, target] });
}

export function unwatchPrototype(id: string, email: string): Prototype | undefined {
  const prototype = getPrototype(id);
  if (!prototype) return undefined;
  const target = normalizeEmail(email);
  const watchers = getWatchers(prototype).filter((e) => e !== target);
  // Persist explicit list (may be empty) so owner unsubscribe sticks
  return updatePrototype(id, { watchers });
}

export function updatePrototype(id: string, patch: Partial<Prototype>): Prototype | undefined {
  const prototype = getPrototype(id);
  if (!prototype) return undefined;

  const updated: Prototype = {
    ...prototype,
    ...patch,
    id: prototype.id,
    updatedAt: new Date().toISOString(),
  };
  savePrototype(updated);
  return updated;
}

export function deletePrototype(id: string): boolean {
  const prototypes = getPrototypes();
  const existing = prototypes.find((p) => p.id === id);
  if (!existing) return false;

  removeCoverImage(existing);
  const next = prototypes.filter((p) => p.id !== id);
  writeJson(PROTOTYPES_FILE, next);

  const comments = readJson<Comment[]>(COMMENTS_FILE, []);
  writeJson(COMMENTS_FILE, comments.filter((c) => c.prototypeId !== id));
  return true;
}

export function publishPrototype(id: string, previewUrl: string): Prototype | undefined {
  const prototype = getPrototype(id);
  if (!prototype) return undefined;

  const updated: Prototype = {
    ...prototype,
    status: "published",
    previewUrl,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  savePrototype(updated);
  return updated;
}

export function getComments(prototypeId: string): Comment[] {
  const all = readJson<Comment[]>(COMMENTS_FILE, []);
  return all
    .filter((c) => c.prototypeId === prototypeId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getComment(id: string): Comment | undefined {
  const all = readJson<Comment[]>(COMMENTS_FILE, []);
  return all.find((c) => c.id === id);
}

export function createComment(prototypeId: string, input: CreateCommentInput, mentions: string[]): Comment {
  const all = readJson<Comment[]>(COMMENTS_FILE, []);
  const now = new Date().toISOString();
  const comment: Comment = {
    id: randomUUID(),
    prototypeId,
    author: input.author,
    authorEmail: input.authorEmail,
    body: input.body,
    route: input.route,
    x: input.x,
    y: input.y,
    status: "open",
    mentions,
    parentId: input.parentId,
    createdAt: now,
    updatedAt: now,
  };
  all.push(comment);
  writeJson(COMMENTS_FILE, all);
  return comment;
}

export function updateCommentStatus(id: string, status: Comment["status"]): Comment | undefined {
  const all = readJson<Comment[]>(COMMENTS_FILE, []);
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) return undefined;
  all[index] = { ...all[index], status, updatedAt: new Date().toISOString() };
  writeJson(COMMENTS_FILE, all);
  return all[index];
}
