"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreatePrototypeModal } from "./CreatePrototypeModal";
import { PrototypeCard } from "./PrototypeCard";
import { Button } from "./ui";
import { isOwnPrototype, type AuthUser } from "@/lib/auth";
import type { Prototype } from "@/lib/types";

type View = "team" | "my-drafts" | "my-published";

const VIEW_META: Record<View, { label: string; description: string }> = {
  team: {
    label: "Team gallery",
    description:
      "Published prototypes from the shared team registry (GitHub) plus yours. Open or copy any live link.",
  },
  "my-drafts": {
    label: "My drafts",
    description: "Your unpublished work - only on this Mac until you publish.",
  },
  "my-published": {
    label: "My published",
    description: "Prototypes you published from this Mac. Push team-registry.json so others see them too.",
  },
};

export function Dashboard() {
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [teamGallery, setTeamGallery] = useState<Prototype[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<View>("team");
  const [user, setUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    const [protoRes, teamRes, meRes] = await Promise.all([
      fetch("/api/prototypes"),
      fetch("/api/team-gallery"),
      fetch("/api/me"),
    ]);
    const data = await protoRes.json();
    const team = await teamRes.json();
    const me = await meRes.json();
    setUser(me.user);
    setPrototypes(data.prototypes ?? []);
    setTeamGallery(team.prototypes ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!user) return [];

    if (view === "team") {
      return teamGallery;
    }
    if (view === "my-drafts") {
      return prototypes.filter((p) => p.status === "draft" && isOwnPrototype(p, user));
    }
    return prototypes.filter((p) => p.status === "published" && isOwnPrototype(p, user));
  }, [prototypes, teamGallery, view, user]);

  const counts = useMemo(() => {
    if (!user) return { team: 0, myDrafts: 0, myPublished: 0 };
    return {
      team: teamGallery.length,
      myDrafts: prototypes.filter((p) => p.status === "draft" && isOwnPrototype(p, user)).length,
      myPublished: prototypes.filter((p) => p.status === "published" && isOwnPrototype(p, user)).length,
    };
  }, [prototypes, teamGallery, user]);

  return (
    <div className="relative z-0 min-h-screen bg-[#050505] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.12),transparent_25%)]"
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">NetApp UX</p>
          <h1 className="text-2xl font-semibold">Proto Hub</h1>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <p className="hidden text-sm text-zinc-500 sm:block" title={user.email}>
              {user.accountId}
              {user.name &&
                user.name.toLowerCase() !== user.accountId.toLowerCase() && (
                  <span className="text-zinc-600"> · {user.name}</span>
                )}
            </p>
          )}
          <Button onClick={() => setModalOpen(true)}>Create new</Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-6 pb-20">
        <section className="pt-4">
          <h2 className="max-w-3xl text-5xl font-medium tracking-tight text-white md:text-6xl">
            Start here. Build anywhere.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-zinc-400">
            Use Cursor or Claude - your choice. Proto Hub gives you a ready folder with Blueprint installed,
            one-click publish to ux.netapp.com, and a shareable link for your team.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Blueprint ready</p>
            <p className="mt-2 text-sm text-zinc-400">
              @netapp/blueprint@legacy is installed in every new project. No npm setup, no registry commands.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">One-click publish</p>
            <p className="mt-2 text-sm text-zinc-400">
              Hit Publish - we build and deploy to ux.netapp.com. Your prototype shows up here; share the link with your team.
            </p>
          </div>
        </section>

        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(VIEW_META) as View[]).map((key) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  view === key ? "bg-white text-black" : "border border-white/10 text-zinc-400 hover:bg-white/5"
                }`}
              >
                {VIEW_META[key].label}
                <span className="ml-2 opacity-70">
                  ({key === "team" ? counts.team : key === "my-drafts" ? counts.myDrafts : counts.myPublished})
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-500">{VIEW_META[view].description}</p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-xl text-zinc-300">
              {view === "team" && "No published prototypes yet"}
              {view === "my-drafts" && "You have no drafts"}
              {view === "my-published" && "You haven't published anything yet"}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {view === "team"
                ? "Publish from My drafts, then commit and push data/team-registry.json so teammates see your link here."
                : "Create new - build in Cursor or Claude, then publish from your draft card."}
            </p>
            {view !== "team" && (
              <Button className="mt-6" onClick={() => setModalOpen(true)}>Create new</Button>
            )}
          </div>
        ) : (
          <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((prototype) => (
              <PrototypeCard
                key={prototype.id}
                prototype={prototype}
                isOwn={user ? isOwnPrototype(prototype, user) : false}
                galleryMode={view === "team"}
                accountId={user?.accountId}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </main>

      <CreatePrototypeModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  );
}
