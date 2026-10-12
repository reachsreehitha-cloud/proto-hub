/**
 * Same comment package for every Proto Hub publish AND (later) every ux.netapp.com page.
 * Always points at one shared UX_COMMENTER_URL → one API, one SSO cookie, one DB.
 */
import fs from "node:fs";
import path from "node:path";

const MARKER = "data-ux-commenter";
const SKIP = "data-ux-commenter-skip";

/** Shared comment service. Override with UX_COMMENTER_URL for local commenter dev. */
export function getCommenterBaseUrl(): string {
  return (process.env.UX_COMMENTER_URL || "https://ux.netapp.com/__commenter").trim().replace(/\/$/, "");
}

function commenterInternalHeaders(): Record<string, string> {
  const token = (process.env.COMMENTER_INTERNAL_TOKEN || "").trim();
  return token ? { "X-Commenter-Internal": token } : {};
}

function stripCommenterTags(html: string): string {
  return html
    .replace(/<script[^>]*data-ux-commenter[^>]*>\s*<\/script>/gi, "")
    .replace(/<script[^>]*src=["'][^"']*widget\.js["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<meta[^>]*name=["']ux-commenter["'][^>]*>/gi, "");
}

/**
 * Inject the shared widget into built index.html.
 * Identical script every prototype gets. No per-app comment stack.
 * Pass enabled:false to remove the widget and mark the page as opted out
 * (also helps when Apache injects overlay.js sitewide).
 */
export function injectCommenterScript(
  distDir: string,
  commenterBaseUrl: string = getCommenterBaseUrl(),
  opts?: { enabled?: boolean },
): { injected: boolean; reason?: string; scriptSrc?: string } {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    return { injected: false, reason: "index.html missing" };
  }

  let html = fs.readFileSync(indexPath, "utf8");
  if (/data-ux-commenter-skip/i.test(html) && opts?.enabled !== true) {
    return { injected: false, reason: "skip attribute present" };
  }

  const enabled = opts?.enabled !== false;
  html = stripCommenterTags(html);

  const injectHead = (snippet: string) => {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${snippet}`);
    } else {
      html = `${snippet}\n${html}`;
    }
  };

  if (!enabled) {
    injectHead(`<meta name="ux-commenter" content="off" ${SKIP} />`);
    fs.writeFileSync(indexPath, html, "utf8");
    return { injected: false, reason: "comments disabled by owner" };
  }

  const base = commenterBaseUrl.replace(/\/$/, "");
  if (!base) {
    return { injected: false, reason: "missing commenter URL" };
  }

  // Overlay only loads when meta is on (sitewide Apache inject + local script).
  injectHead(`<meta name="ux-commenter" content="on" ${MARKER} />`);

  // Local commenter has no Apache inject. Ship the overlay script.
  // On ux.netapp.com Apache already injects /__commenter/overlay.js for /~ paths.
  const isUxHosted =
    /ux\.netapp\.com\/__commenter/i.test(base) || /\/__commenter$/i.test(base);
  let scriptSrc: string | undefined;
  if (!isUxHosted) {
    scriptSrc = `${base}/overlay.js`;
    const tag = `<script ${MARKER} src="${scriptSrc}" defer></script>`;
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `  ${tag}\n</body>`);
    } else {
      html = `${html}\n${tag}\n`;
    }
  }

  fs.writeFileSync(indexPath, html, "utf8");
  return { injected: true, scriptSrc };
}

/**
 * Register the publisher as the only site admin who may toggle live comments.
 * Requires COMMENTER_INTERNAL_TOKEN on both Proto Hub and the commenter service.
 */
export async function registerSiteAdmin(opts: {
  commenterBaseUrl?: string;
  siteId: string;
  ldap: string;
  email?: string;
  name?: string;
}): Promise<void> {
  const base = (opts.commenterBaseUrl || getCommenterBaseUrl()).replace(/\/$/, "");
  if (!base || !opts.siteId || !opts.ldap) return;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...commenterInternalHeaders(),
  };
  if (!headers["X-Commenter-Internal"]) {
    console.warn("[ux-commenter] COMMENTER_INTERNAL_TOKEN unset. Admin not registered");
    return;
  }
  try {
    await fetch(`${base}/api/sites/admin?site=${encodeURIComponent(opts.siteId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ldap: opts.ldap.trim().toLowerCase(),
        email: opts.email || `${opts.ldap}@netapp.com`,
        name: opts.name || opts.ldap,
      }),
    });
  } catch (err) {
    console.warn("[ux-commenter] could not register site admin:", err);
  }
}

export type LiveCommentsSyncResult = {
  ok: boolean;
  status?: number;
  detail?: string;
};

/**
 * Tell the shared commenter service this live site should show/hide the overlay.
 * Only the registered owner (internal token + matching ldap, or signed-in admin).
 */
export async function setLiveCommentsEnabled(opts: {
  commenterBaseUrl?: string;
  siteId: string;
  enabled: boolean;
  ownerLdap?: string;
  cookie?: string;
}): Promise<LiveCommentsSyncResult> {
  const base = (opts.commenterBaseUrl || getCommenterBaseUrl()).replace(/\/$/, "");
  if (!base || !opts.siteId) {
    return { ok: false, detail: "Missing commenter URL or site id" };
  }

  const url = `${base}/api/sites/settings?site=${encodeURIComponent(opts.siteId)}`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...commenterInternalHeaders(),
    };
    if (!headers["X-Commenter-Internal"]) {
      return {
        ok: false,
        detail: "COMMENTER_INTERNAL_TOKEN is not set (or not accepted). Republish to apply on the live page.",
      };
    }
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.ownerLdap) headers["X-Commenter-Owner"] = opts.ownerLdap.trim().toLowerCase();
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ enabled: opts.enabled }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail =
        res.status === 401 || res.status === 403
          ? "Commenter service rejected the toggle (auth). Republish with Comments off to hide the live bubble."
          : `Commenter sync failed (${res.status}). ${body.slice(0, 120)}`;
      console.warn("[ux-commenter] setLiveCommentsEnabled:", res.status, body.slice(0, 200));
      return { ok: false, status: res.status, detail };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Commenter unreachable";
    console.warn("[ux-commenter] could not sync comments enabled:", err);
    return { ok: false, detail };
  }
}

/**
 * Touch the shared notebook for this live URL (auto-create folder). Optional.
 * Widget also does this on first open. So publish does not depend on it.
 */
export async function ensureCommenterProject(opts: {
  commenterBaseUrl?: string;
  name: string;
  sourceUrl: string;
  owner?: string;
}): Promise<void> {
  const base = (opts.commenterBaseUrl || getCommenterBaseUrl()).replace(/\/$/, "");
  if (!base) return;

  try {
    await fetch(`${base}/api/projects/ensure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: opts.name,
        sourceUrl: opts.sourceUrl,
        owner: opts.owner || "",
      }),
    });
  } catch (err) {
    console.warn("[ux-commenter] ensure unreachable (widget will create on first open):", err);
  }
}
