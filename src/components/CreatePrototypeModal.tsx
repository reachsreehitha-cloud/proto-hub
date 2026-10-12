"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Textarea } from "./ui";
import type { EditorChoice } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Defaults {
  desktopPath: string;
  canPickFolder: boolean;
}

interface PrerequisiteIssue {
  id: string;
  message: string;
  severity: "blocker" | "warning";
  helpUrl?: string;
}

interface PrerequisiteReport {
  ok: boolean;
  blockers: PrerequisiteIssue[];
  warnings: PrerequisiteIssue[];
  autoFixed?: string[];
  blueprintBundled?: boolean;
}

interface ScaffoldResult {
  folderPath: string;
  installStatus: string;
  installMessage: string;
  installHelpUrl?: string;
  opened: boolean;
  editor: EditorChoice;
  localPort?: number;
  localPreviewUrl?: string;
  previewStarted?: boolean;
}

type Step = "details" | "location" | "editor" | "creating" | "done";

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function folderName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function parentLabel(parentFolder: string, desktopPath: string) {
  if (parentFolder === desktopPath) return "Desktop";
  return folderName(parentFolder);
}

export function CreatePrototypeModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentFolder, setParentFolder] = useState("");
  const [editor, setEditor] = useState<EditorChoice>("cursor");
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [prerequisites, setPrerequisites] = useState<PrerequisiteReport | null>(null);
  const [checkingPrerequisites, setCheckingPrerequisites] = useState(false);
  const [result, setResult] = useState<ScaffoldResult | null>(null);
  const [error, setError] = useState("");
  const [pathConflict, setPathConflict] = useState("");
  const [checkingPath, setCheckingPath] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);

  const desktopPath = defaults?.desktopPath ?? "";
  const slug = slugFromName(name) || "prototype";

  const folderPath = useMemo(() => {
    if (!parentFolder) return "";
    return `${parentFolder}/${slug}`;
  }, [parentFolder, slug]);

  async function loadPrerequisites(selectedEditor: EditorChoice) {
    setCheckingPrerequisites(true);
    try {
      const res = await fetch(`/api/prototypes/prerequisites?editor=${selectedEditor}`);
      const data = (await res.json()) as PrerequisiteReport;
      setPrerequisites(data);
    } catch {
      setPrerequisites(null);
    } finally {
      setCheckingPrerequisites(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/prototypes/defaults")
      .then((res) => res.json())
      .then((data) => {
        setDefaults({ desktopPath: data.desktopPath, canPickFolder: data.canPickFolder });
        setParentFolder(data.desktopPath);
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadPrerequisites(editor);
  }, [editor, open]);

  // Clear stale create errors whenever the proposed path changes.
  useEffect(() => {
    setError("");
  }, [folderPath]);

  // Live check so conflicts show on step 1 as soon as the name resolves.
  useEffect(() => {
    if (!open || !folderPath || !name.trim()) {
      setPathConflict("");
      setCheckingPath(false);
      return;
    }

    let cancelled = false;
    setCheckingPath(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/prototypes/defaults?path=${encodeURIComponent(folderPath)}`);
        const data = await res.json();
        if (cancelled) return;
        const check = data.folderCheck as { exists?: boolean; message?: string | null } | null;
        if (res.ok && check?.exists) {
          setPathConflict(check.message || `A folder already exists at: ${folderPath}`);
        } else {
          setPathConflict("");
        }
      } catch {
        if (!cancelled) setPathConflict("");
      } finally {
        if (!cancelled) setCheckingPath(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, folderPath, name]);

  async function handlePickFolder() {
    if (!defaults?.canPickFolder) return;
    setPickingFolder(true);
    setError("");
    try {
      const res = await fetch("/api/prototypes/pick-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPath: parentFolder || desktopPath }),
      });
      const data = await res.json();
      if (data.cancelled) return;
      if (!res.ok) throw new Error(data.error || "Could not open folder picker");
      setParentFolder(data.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder picker");
    } finally {
      setPickingFolder(false);
    }
  }

  if (!open) return null;

  async function handleCreate() {
    if (pathConflict) {
      setStep("details");
      return;
    }
    setStep("creating");
    setError("");
    try {
      const res = await fetch("/api/prototypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, folderPath, editor }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.prerequisites) setPrerequisites(data.prerequisites);
        throw new Error(data.error || "Failed to create prototype");
      }

      const scaffold = data.scaffold as ScaffoldResult;
      const prototypeId =
        typeof data.prototype?.id === "string" ? data.prototype.id : "";
      setResult(scaffold);
      setStep("done");
      onCreated();
      // Wait until Vite is reachable, then open. Avoids “site cannot be reached”
      if (scaffold?.localPreviewUrl && scaffold.installStatus === "success" && prototypeId) {
        void (async () => {
          try {
            const previewRes = await fetch(`/api/prototypes/${prototypeId}/start-preview`, {
              method: "POST",
            });
            const previewData = await previewRes.json();
            const url =
              typeof previewData.url === "string" && previewData.url
                ? previewData.url
                : scaffold.localPreviewUrl;
            if (previewRes.ok && url) {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          } catch {
            // Create still succeeded; user can use Open preview on the card
          }
        })();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      if (/folder already exists/i.test(message)) {
        setPathConflict(message);
        setStep("details");
      } else {
        // Cursor-only: return to location (editor step disabled. See commented block below)
        setStep("location");
        // setStep("editor"); // RESTORE with Claude/cloud editor step
      }
    }
  }

  function handleClose() {
    setStep("details");
    setName("");
    setDescription("");
    setParentFolder(desktopPath);
    setEditor("cursor");
    setResult(null);
    setError("");
    setPathConflict("");
    onClose();
  }

  // Cursor-only: 2 steps (details → location → create). Editor step kept in type for restore.
  const stepNumber = { details: 1, location: 2, editor: 2, creating: 2, done: 2 }[step];
  const showStepIndicator = step !== "done";
  const locationLabel = parentLabel(parentFolder, desktopPath);
  const hasBlockers = (prerequisites?.blockers.length ?? 0) > 0;
  const canLeaveDetails =
    !!name.trim() && !hasBlockers && !checkingPrerequisites && !pathConflict && !checkingPath;

  function PrerequisitesPanel({ compact = false }: { compact?: boolean }) {
    if (!prerequisites) return null;

    const showReady =
      prerequisites.ok &&
      prerequisites.blockers.length === 0 &&
      !checkingPrerequisites &&
      !compact;

    if (
      !showReady &&
      prerequisites.blockers.length === 0 &&
      prerequisites.warnings.length === 0 &&
      (prerequisites.autoFixed?.length ?? 0) === 0
    ) {
      return null;
    }

    return (
      <div className={`space-y-2 ${compact ? "" : "rounded-2xl border border-white/10 bg-white/[0.03] p-4"}`}>
        {checkingPrerequisites && (
          <p className="text-xs text-zinc-500">Getting things ready…</p>
        )}
        {showReady && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <p className="font-medium">You are ready to create.</p>
            <p className="mt-1 text-emerald-200/80">
              Proto Hub finds or installs Node if needed, copies Blueprint to your Desktop, opens
              Cursor, and starts the preview link for you. No terminal.
            </p>
          </div>
        )}
        {(prerequisites.autoFixed?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
            <p className="font-medium">Proto Hub handled this for you:</p>
            <ul className="mt-1 list-disc pl-5 text-violet-200/90">
              {prerequisites.autoFixed?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {prerequisites.blockers.map((issue) => (
          <div key={issue.id} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>{issue.message}</p>
            {issue.helpUrl && (
              <a href={issue.helpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-red-200 underline-offset-2 hover:underline">
                How to fix
              </a>
            )}
          </div>
        ))}
        {prerequisites.warnings.map((issue) => (
          <div key={issue.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <p>{issue.message}</p>
            {issue.helpUrl && (
              <a href={issue.helpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-amber-200 underline-offset-2 hover:underline">
                Learn more
              </a>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            {showStepIndicator && (
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                {step === "creating" ? "Creating…" : `Step ${stepNumber} of 2`}
              </p>
            )}
            <h2 className="text-2xl font-semibold text-white">Create new prototype</h2>
          </div>
          {step !== "creating" && (
            <button onClick={handleClose} className="text-sm text-zinc-500 hover:text-white">Close</button>
          )}
        </div>

        {step === "details" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Name your prototype - Proto Hub does the rest: copies Blueprint to your Desktop, sets up Cursor rules, and opens Cursor.
            </p>
            <PrerequisitesPanel />
            <div>
              <label className="mb-2 block text-sm text-zinc-400">Prototype name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ONTAP upgrades flow"
                required
              />
              {name.trim() && (
                <p className="mt-2 text-xs text-zinc-500">
                  Folder name: <span className="text-zinc-300">{slug}</span>
                  {parentFolder ? ` → ${parentFolder}/${slug}` : ""}
                </p>
              )}
              {checkingPath && name.trim() && (
                <p className="mt-2 text-xs text-zinc-500">Checking folder…</p>
              )}
              {pathConflict && (
                <p className="mt-2 text-sm text-red-400">{pathConflict}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-400">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you exploring?" rows={3} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep("location")} disabled={!canLeaveDetails}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "location" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handlePickFolder}
              disabled={pickingFolder || !defaults?.canPickFolder}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-violet-400/40 hover:bg-violet-500/5 disabled:opacity-60"
            >
              <p className="text-sm text-zinc-500">Save location · click to change</p>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-lg">
                  📁
                </div>
                <div className="min-w-0 flex-1">
                  {pickingFolder ? (
                    <p className="text-xl font-semibold text-white">Opening Finder…</p>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-xl font-semibold text-white">{locationLabel}</span>
                      <span className="text-lg text-zinc-500">/</span>
                      <span className="text-xl font-semibold text-white">{slug}</span>
                    </div>
                  )}
                  <p className="mt-2 truncate text-xs text-zinc-600">{folderPath}</p>
                </div>
              </div>
            </button>

            {defaults?.canPickFolder ? (
              <p className="text-xs text-zinc-500">Defaults to Desktop. Click above to pick a different folder in Finder.</p>
            ) : (
              <p className="text-xs text-zinc-500">Saving to Desktop.</p>
            )}

            {pathConflict && <p className="text-sm text-red-400">{pathConflict}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={() => setStep("details")}>Back</Button>
              <Button
                onClick={() => {
                  setEditor("cursor");
                  void handleCreate();
                }}
                disabled={
                  !folderPath.trim() ||
                  pickingFolder ||
                  !!pathConflict ||
                  checkingPath ||
                  hasBlockers ||
                  checkingPrerequisites
                }
              >
                Create & open in Cursor
              </Button>
              {/*
              // RESTORE: editor picker step (Cursor vs Claude/cloud)
              <Button
                onClick={() => setStep("editor")}
                disabled={!folderPath.trim() || pickingFolder || !!pathConflict || checkingPath}
              >
                Next
              </Button>
              */}
            </div>
          </div>
        )}

        {/*
        // RESTORE: Claude / cloud editor choice step
        {step === "editor" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Pick where you want to build. Blueprint is already in the folder we copy.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEditor("cursor")}
                className={`rounded-2xl border p-5 text-left transition ${
                  editor === "cursor" ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 hover:bg-white/5"
                }`}
              >
                <p className="text-lg font-medium text-white">Cursor</p>
                <p className="mt-2 text-sm text-zinc-400">Desktop app</p>
              </button>
              <button
                type="button"
                onClick={() => setEditor("claude")}
                className={`rounded-2xl border p-5 text-left transition ${
                  editor === "claude" ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 hover:bg-white/5"
                }`}
              >
                <p className="text-lg font-medium text-white">Claude</p>
                <p className="mt-2 text-sm text-zinc-400">Desktop app</p>
              </button>
            </div>
            <PrerequisitesPanel compact />
            {pathConflict && <p className="text-sm text-red-400">{pathConflict}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={() => setStep("location")}>Back</Button>
              <Button onClick={handleCreate} disabled={hasBlockers || checkingPrerequisites || !!pathConflict}>
                Create & open
              </Button>
            </div>
          </div>
        )}
        */}

        {step === "creating" && (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-lg text-white">Creating your prototype…</p>
            <p className="text-sm text-zinc-400">Copying your starter folder and opening Cursor.</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-4 text-sm ${
              result.installStatus === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-amber-500/20 bg-amber-500/10 text-amber-100"
            }`}>
              {result.opened && (
                <p className="mb-2 font-medium">
                  Opened in Cursor.
                </p>
              )}
              <p>{result.installMessage}</p>
              {result.installStatus === "success" && (
                <div className="mt-2 space-y-2 text-emerald-200/80">
                  <p>
                    Cursor opens automatically. Preview starts for you. Proto Hub also opens the
                    local link in your browser (no terminal).
                  </p>
                  {result.localPreviewUrl && (
                    <p>
                      Preview:{" "}
                      <a
                        href={result.localPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-emerald-100 underline underline-offset-2"
                      >
                        {result.localPreviewUrl}
                      </a>
                    </p>
                  )}
                  <p>
                    In Cursor, open <span className="font-medium">CURSOR_PROMPT.md</span> (or Proto
                    Hub → Help) for prompts.
                  </p>
                </div>
              )}
              {result.installStatus !== "success" && (
                <p className="mt-2 text-amber-200/80">
                  Your folder is on Desktop. Connect to VPN, then click Create again or contact the UX platform team.
                </p>
              )}
            </div>
            {result.installHelpUrl && (
              <a
                href={result.installHelpUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-violet-300 underline-offset-2 hover:underline"
              >
                GitHub package authentication guide
              </a>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              <p className="font-medium text-white">Try this prompt first (one-shot)</p>
              <p className="mt-2 text-zinc-400">
                Replace the Home page with a Systems discovery screen: title + actions, PageAlert, MetricPropertyBand,
                filters, and a systems table. Reuse{" "}
                <code className="text-zinc-200">consolePatterns.tsx</code> and follow{" "}
                <code className="text-zinc-200">FIGMA_COMPONENT_CONFIG.md</code>. Keep PrototypeShell and{" "}
                <code className="text-zinc-200">@netapp/blueprint/css</code>. Use left nav only. No starter
                cards or “open other page” buttons.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Folder</p>
              <p className="text-sm text-white">
                <span className="font-semibold">{locationLabel}</span>
                <span className="text-zinc-500"> / </span>
                <span className="font-semibold">{slug}</span>
              </p>
              <code className="mt-1 block rounded-xl bg-black/40 p-3 text-xs text-zinc-500">{result.folderPath}</code>
            </div>
            <Button className="w-full" onClick={handleClose}>Back to dashboard</Button>
          </div>
        )}
      </div>
    </div>
  );
}
