import fs from "node:fs";
import path from "node:path";
import type { Prototype } from "./types";

export interface TeamRegistryEntry {
  id: string;
  name: string;
  slug: string;
  description?: string;
  author: string;
  authorEmail: string;
  previewUrl: string;
  publishedAt?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_FILE = path.join(DATA_DIR, "team-registry.json");

const DEFAULT_REMOTE =
  process.env.TEAM_REGISTRY_URL ||
  "https://raw.githubusercontent.com/reachsreehitha-cloud/proto-hub/main/data/team-registry.json";

export function readLocalRegistry(): TeamRegistryEntry[] {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8")) as TeamRegistryEntry[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocalRegistry(entries: TeamRegistryEntry[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2) + "\n");
}

async function fetchRemoteRegistry(): Promise<TeamRegistryEntry[]> {
  try {
    const res = await fetch(DEFAULT_REMOTE, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as TeamRegistryEntry[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function entryKey(entry: { authorEmail: string; slug: string; previewUrl?: string }) {
  if (entry.previewUrl?.trim()) return `url:${entry.previewUrl.trim().replace(/\/$/, "")}`;
  return `owner:${entry.authorEmail.toLowerCase()}:${entry.slug}`;
}

export function registryEntryFromPrototype(prototype: Prototype): TeamRegistryEntry {
  return {
    id: `registry-${prototype.authorEmail.split("@")[0]}-${prototype.slug}`,
    name: prototype.name,
    slug: prototype.slug,
    description: prototype.description || "",
    author: prototype.author,
    authorEmail: prototype.authorEmail,
    previewUrl: prototype.previewUrl,
    publishedAt: prototype.publishedAt || new Date().toISOString(),
  };
}

/** Remove a gallery listing from the local team-registry.json (by id or url). */
export function removeFromLocalRegistry(opts: {
  id?: string;
  previewUrl?: string;
  authorEmail?: string;
  slug?: string;
}): boolean {
  const entries = readLocalRegistry();
  const next = entries.filter((entry) => {
    if (opts.id && entry.id === opts.id) return false;
    if (
      opts.previewUrl &&
      entry.previewUrl?.replace(/\/$/, "") === opts.previewUrl.replace(/\/$/, "")
    ) {
      return false;
    }
    if (
      opts.authorEmail &&
      opts.slug &&
      entry.authorEmail.toLowerCase() === opts.authorEmail.toLowerCase() &&
      entry.slug === opts.slug
    ) {
      return false;
    }
    return true;
  });
  if (next.length === entries.length) return false;
  writeLocalRegistry(next);
  return true;
}

/** Upsert into the committed team-registry.json so teammates can pull it. */
export function upsertLocalRegistry(prototype: Prototype): TeamRegistryEntry {
  const next = registryEntryFromPrototype(prototype);
  const entries = readLocalRegistry();
  const key = entryKey(next);
  const index = entries.findIndex((e) => entryKey(e) === key);
  if (index >= 0) entries[index] = { ...entries[index], ...next };
  else entries.unshift(next);
  writeLocalRegistry(entries);
  return next;
}

export function entryToPrototype(entry: TeamRegistryEntry): Prototype {
  const now = entry.publishedAt || new Date().toISOString();
  return {
    id: entry.id,
    name: entry.name,
    slug: entry.slug,
    description: entry.description || "",
    author: entry.author,
    authorEmail: entry.authorEmail,
    previewUrl: entry.previewUrl,
    folderPath: "",
    status: "published",
    coverMode: "auto",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    fromRegistry: true,
  };
}

/**
 * Team gallery = local published prototypes + shared registry
 * (local file + GitHub raw, so clones see others without republishing).
 */
export async function getTeamGalleryPrototypes(local: Prototype[]): Promise<Prototype[]> {
  const localPublished = local.filter((p) => p.status === "published" && p.previewUrl);
  const seen = new Set(localPublished.map((p) => entryKey(p)));

  const merged: Prototype[] = [...localPublished];
  const remote = await fetchRemoteRegistry();
  const localFile = readLocalRegistry();

  for (const entry of [...localFile, ...remote]) {
    if (!entry?.previewUrl || !entry.slug) continue;
    const key = entryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entryToPrototype(entry));
  }

  return merged.sort((a, b) => {
    const aTime = a.publishedAt || a.updatedAt;
    const bTime = b.publishedAt || b.updatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}
