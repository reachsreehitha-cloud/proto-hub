import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getCurrentUser } from "./auth";
import { ensureCommenterProject, getCommenterBaseUrl, injectCommenterScript, registerSiteAdmin, setLiveCommentsEnabled } from "./commenterInject";
import { slugify } from "./paths";

/**
 * Mirrors @netapp/ux-deploy / deploy-openlab-web.sh
 * https://netapp.atlassian.net/wiki/spaces/UX/pages/666084699
 *
 * Flow:
 * 1. Build prototype → dist/
 * 2. Open SSH ControlMaster (password via expect, or key)
 * 3. mkdir ~/web/{app}
 * 4. tar dist contents | ssh → extract
 * 5. chmod home/web/app
 * 6. Live at https://ux.netapp.com/~{user}/{app}/
 */

const SSH_HOST = process.env.UX_SSH_HOST || "cyclortp.rtp.openenglab.netapp.com";
const BROWSE_HOST = process.env.UX_BROWSE_HOST || "ux.netapp.com";
const REMOTE_BASE = process.env.UX_REMOTE_BASE || "~/web";

export interface PublishCredentials {
  username: string;
  password: string;
}

export interface PublishResult {
  previewUrl: string;
  shareUrl: string;
  deployPath: string;
  /** Shared commenter host every prototype uses (same API / SSO / DB). */
  commenterUrl?: string;
  commentsInjected?: boolean;
}

function run(cmd: string, args: string[], cwd?: string) {
  const result = spawnSync(cmd, args, { cwd, stdio: "pipe", encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${cmd} failed`);
  }
  return result.stdout;
}

function normalizeUsername(username: string): string {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(value)) {
    throw new Error("Could not determine your NetApp account for deploy.");
  }
  return value;
}

function ldapFromContext(username?: string): string {
  if (username?.trim()) return normalizeUsername(username);
  const email = getCurrentUser().email;
  return email.split("@")[0] || process.env.UX_USER || process.env.USER || "user";
}

function stripBanner(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.includes("You have logged into a NetApp computer system"))
    .join("\n")
    .trim();
}

function friendlySshError(detail: string, username?: string): string {
  const text = stripBanner(detail).toLowerCase();

  if (
    text.includes("permission denied") ||
    text.includes("authentication failed") ||
    text.includes("password rejected")
  ) {
    return [
      "SSH login failed.",
      `Tried username "${username || "?"}" - confirm your short NetApp ID (e.g. dyland, not full name).`,
      "Use the password that works for NetApp SSO / OpenLab SSH.",
      "Connect VPN / Zscaler (@netapp.com), then retry.",
    ].join(" ");
  }
  if (
    text.includes("could not resolve hostname") ||
    text.includes("operation timed out") ||
    text.includes("timed out") ||
    text.includes("exit 124")
  ) {
    return "Cannot reach the deploy server. Connect to VPN / Zscaler and try again.";
  }
  const trimmed = stripBanner(detail);
  if (trimmed) return trimmed;
  return `SSH upload failed. Check VPN and confirm \`ssh ${target}\` works in Terminal.`;
}

/** Build via scripts/build-blueprint-app.mjs → project/dist/ (same as OpenLab). */
function buildDist(folderPath: string): string {
  const buildScript = path.join(folderPath, "scripts", "build-blueprint-app.mjs");
  const distDir = path.join(folderPath, "dist");

  if (fs.existsSync(buildScript)) {
    run(process.execPath, [buildScript], folderPath);
  } else {
    const appDir = path.join(folderPath, "blueprint-app");
    run("npm", ["run", "build"], appDir);
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.cpSync(path.join(appDir, "dist"), distDir, { recursive: true });
  }

  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error("Build finished but dist/index.html was not found.");
  }

  return distDir;
}

type SshSession = {
  target: string;
  controlPath: string;
  controlDir: string;
};

function sshArgs(controlPath: string, extra: string[] = []): string[] {
  return [
    "-o",
    "ControlMaster=auto",
    "-o",
    "ControlPersist=5m",
    "-o",
    `ControlPath=${controlPath}`,
    "-o",
    "ConnectTimeout=20",
    "-o",
    "StrictHostKeyChecking=accept-new",
    ...extra,
  ];
}

function cleanupSession(session: SshSession) {
  spawnSync(
    "ssh",
    [...sshArgs(session.controlPath), "-O", "exit", session.target],
    { encoding: "utf-8", timeout: 10000 },
  );
  fs.rmSync(session.controlDir, { recursive: true, force: true });
}

function openSessionWithKey(username: string): SshSession | null {
  const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-hub-ssh-"));
  const controlPath = path.join(controlDir, "socket");
  const target = `${username}@${SSH_HOST}`;

  const check = spawnSync(
    "ssh",
    [
      ...sshArgs(controlPath, ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8"]),
      target,
      "echo ok",
    ],
    { encoding: "utf-8", timeout: 30000 },
  );

  if (check.status !== 0) {
    fs.rmSync(controlDir, { recursive: true, force: true });
    return null;
  }

  return { target, controlPath, controlDir };
}

/**
 * Authenticate once over a TTY (expect), keep ControlMaster open.
 * Paths/password come from env so we never nest bash quoting around -o flags.
 */
function openSessionWithPassword(username: string, password: string): SshSession {
  if (spawnSync("/usr/bin/expect", ["-c", "exit 0"], { encoding: "utf-8" }).status !== 0) {
    throw new Error("macOS `expect` is required for password publish. Install Xcode CLT or use Terminal deploy.");
  }

  const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-hub-ssh-"));
  const controlPath = path.join(controlDir, "socket");
  const target = `${username}@${SSH_HOST}`;
  const stamp = Date.now();
  const passFile = path.join(os.tmpdir(), `proto-hub-pass-${stamp}.txt`);
  const expectScript = path.join(os.tmpdir(), `proto-hub-expect-${stamp}.exp`);

  fs.writeFileSync(passFile, password, { encoding: "utf-8", mode: 0o600 });

  // Spawn /usr/bin/ssh directly - no bash -c, no nested quotes on -o.
  fs.writeFileSync(
    expectScript,
    `#!/usr/bin/expect -f
set timeout 60
set pass_file $env(PROTO_HUB_SSH_PASS_FILE)
set control_path $env(PROTO_HUB_SSH_CONTROL_PATH)
set target $env(PROTO_HUB_SSH_TARGET)
set fh [open $pass_file r]
set password [string trimright [read $fh] "\\r\\n"]
close $fh
set sent_password 0
log_user 1
spawn -noecho /usr/bin/ssh -o ControlMaster=auto -o ControlPersist=5m -o ControlPath=$control_path -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=keyboard-interactive,password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=3 $target echo SSH_OK
expect {
  -re {(?i)are you sure you want to continue connecting.*} {
    send -- "yes\\r"
    exp_continue
  }
  -re {(?i)password:} {
    if {$sent_password >= 2} {
      puts stderr "SSH password rejected"
      exit 1
    }
    incr sent_password
    send -- "$password\\r"
    exp_continue
  }
  -re {SSH_OK} { }
  -re {(?i)permission denied} {
    puts stderr "Permission denied"
    exit 1
  }
  timeout {
    puts stderr "SSH login timed out"
    exit 124
  }
  eof
}
catch {wait} result
set exitCode [lindex $result 3]
if {$exitCode == ""} { set exitCode 1 }
exit $exitCode
`,
    { mode: 0o700 },
  );

  const result = spawnSync("/usr/bin/expect", [expectScript], {
    env: {
      ...process.env,
      PROTO_HUB_SSH_PASS_FILE: passFile,
      PROTO_HUB_SSH_CONTROL_PATH: controlPath,
      PROTO_HUB_SSH_TARGET: target,
    },
    encoding: "utf-8",
    timeout: 90000,
  });

  fs.rmSync(expectScript, { force: true });
  fs.rmSync(passFile, { force: true });

  if (result.status !== 0) {
    fs.rmSync(controlDir, { recursive: true, force: true });
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(friendlySshError(detail, username));
  }

  return { target, controlPath, controlDir };
}

function sshRun(session: SshSession, remoteCmd: string) {
  const result = spawnSync(
    "ssh",
    [...sshArgs(session.controlPath), session.target, remoteCmd],
    { encoding: "utf-8", timeout: 120000 },
  );
  if (result.status !== 0) {
    throw new Error(stripBanner(result.stderr || result.stdout || "Remote command failed"));
  }
  return result.stdout;
}

/** Pipe tar → ssh with argv arrays (no bash string quoting). */
function uploadDist(session: SshSession, distDir: string, remoteAppDir: string) {
  const archive = spawnSync("tar", ["-C", distDir, "-czf", "-", "."], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (archive.status !== 0) {
    throw new Error(archive.stderr?.toString() || "Failed to create deploy archive");
  }

  const upload = spawnSync(
    "ssh",
    [
      ...sshArgs(session.controlPath),
      session.target,
      `tar -xzf - --no-overwrite-dir -C ${remoteAppDir}`,
    ],
    {
      input: archive.stdout,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 180000,
    },
  );

  if (upload.status !== 0) {
    throw new Error(stripBanner(upload.stderr || upload.stdout || "Upload to ux.netapp.com failed"));
  }
}

/**
 * Same steps as deploy-openlab-web.sh - user only provides SSO password in Proto Hub UI.
 */
export async function publishPrototypeToUx(
  folderPath: string,
  name: string,
  hubReviewUrl: string,
  credentials?: PublishCredentials,
  appSlug?: string,
  commentsEnabled: boolean = true,
): Promise<PublishResult> {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Prototype folder not found: ${folderPath}`);
  }

  const username = normalizeUsername(credentials?.username || ldapFromContext());
  const appName = (appSlug?.trim() || slugify(name) || "prototype").toLowerCase();
  // OpenLab: files live in ~/web/{app} - Apache maps ~user → home, so URL is /~user/app/
  const remoteAppDir = `${REMOTE_BASE}/${appName}`;
  const previewUrl = `https://${BROWSE_HOST}/~${username}/${appName}/`;
  const siteId = `~${username}/${appName}`;

  const distDir = buildDist(folderPath);

  // Shared comment package. Owner can opt out via Proto Hub commentsEnabled.
  const commenterBase = getCommenterBaseUrl();
  const inject = injectCommenterScript(distDir, commenterBase, { enabled: commentsEnabled });
  await ensureCommenterProject({
    commenterBaseUrl: commenterBase,
    name,
    sourceUrl: previewUrl,
    owner: username,
  });
  // Publisher becomes the only admin who may turn live comments on/off.
  await registerSiteAdmin({
    commenterBaseUrl: commenterBase,
    siteId,
    ldap: username,
    email: `${username}@netapp.com`,
    name: username,
  });
  await setLiveCommentsEnabled({
    commenterBaseUrl: commenterBase,
    siteId,
    enabled: commentsEnabled,
    ownerLdap: username,
  });

  let session: SshSession | null = null;

  try {
    if (credentials?.password?.trim()) {
      session = openSessionWithPassword(username, credentials.password.trim());
    } else {
      session = openSessionWithKey(username);
      if (!session) {
        throw new Error("Enter your NetApp SSO password to publish.");
      }
    }

    sshRun(session, `mkdir -p ${remoteAppDir}`);
    uploadDist(session, distDir, remoteAppDir);
    try {
      sshRun(session, `chmod 0711 ~ && chmod 0755 ${REMOTE_BASE} && chmod -R 0755 ${remoteAppDir}`);
    } catch {
      // Best-effort - same as OpenLab script
    }
  } finally {
    if (session) cleanupSession(session);
  }

  return {
    previewUrl,
    shareUrl: hubReviewUrl,
    deployPath: `~${username}/${appName}`,
    commenterUrl: commenterBase,
    commentsInjected: inject.injected,
  };
}
