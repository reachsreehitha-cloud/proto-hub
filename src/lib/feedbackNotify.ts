import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type FeedbackDelivery = {
  saved: boolean;
  emailSent: boolean;
  channel: "smtp" | "outlook" | "mail" | "none";
  detail: string;
  inboxDir: string;
};

function escapeAppleScript(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function runOsascript(source: string): { ok: boolean; err?: string } {
  try {
    execFileSync("osascript", ["-e", source], {
      encoding: "utf8",
      timeout: 45000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, err: message.slice(0, 400) };
  }
}

function macNotification(title: string, body: string) {
  const t = escapeAppleScript(title.slice(0, 80));
  const b = escapeAppleScript(body.slice(0, 180).replace(/\n/g, " "));
  runOsascript(
    `display notification "${b}" with title "${t}" sound name "Glass"`,
  );
}

function feedbackRoot() {
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Proto Hub",
    "feedback-inbox",
  );
}

/** Copy screenshot files into the inbox folder so they can be opened and attached. */
function stageScreenshots(id: string, screenshotFiles: string[]): string[] {
  const shotDir = path.join(feedbackRoot(), id, "screenshots");
  fs.mkdirSync(shotDir, { recursive: true });
  const staged: string[] = [];
  for (const src of screenshotFiles) {
    if (!src || !fs.existsSync(src)) continue;
    const dest = path.join(shotDir, path.basename(src));
    try {
      fs.copyFileSync(src, dest);
      staged.push(dest);
    } catch (err) {
      console.error("[proto-hub feedback] could not stage screenshot:", err);
    }
  }
  return staged;
}

function writeInboxCopy(options: {
  to: string;
  subject: string;
  text: string;
  id: string;
  screenshotFiles: string[];
}): { inboxFile: string; bodyFile: string; inboxDir: string; stagedShots: string[] } {
  const inboxDir = path.join(feedbackRoot(), options.id);
  fs.mkdirSync(inboxDir, { recursive: true });
  const stagedShots = stageScreenshots(options.id, options.screenshotFiles);

  const shotLines =
    stagedShots.length > 0
      ? [
          "",
          `Screenshots (${stagedShots.length}) are attached to this email.`,
          "Also saved here on this Mac:",
          ...stagedShots.map((p) => `  ${p}`),
          "",
          `Folder: ${path.join(inboxDir, "screenshots")}`,
        ]
      : ["", "No screenshots attached."];

  const fullText = [options.text, ...shotLines].join("\n");
  const inboxFile = path.join(inboxDir, "report.txt");
  const bodyFile = path.join(inboxDir, "body.txt");
  fs.writeFileSync(
    inboxFile,
    [`To: ${options.to}`, `Subject: ${options.subject}`, "", fullText, ""].join("\n"),
  );
  fs.writeFileSync(bodyFile, fullText);
  fs.writeFileSync(path.join(feedbackRoot(), "LATEST.txt"), fs.readFileSync(inboxFile));
  // Pointer so you can jump to the latest screenshots folder
  fs.writeFileSync(
    path.join(feedbackRoot(), "LATEST_FOLDER.txt"),
    stagedShots.length ? path.join(inboxDir, "screenshots") : inboxDir,
  );
  return { inboxFile, bodyFile, inboxDir, stagedShots };
}

function appleScriptAttachList(files: string[]): string {
  if (files.length === 0) return "";
  return files
    .map(
      (file, i) => `
  set shot${i} to POSIX file "${escapeAppleScript(file)}"
`,
    )
    .join("");
}

function sendViaOutlook(to: string, subject: string, bodyFile: string, shots: string[]): boolean {
  const attachSetup = appleScriptAttachList(shots);
  const attachCalls = shots
    .map(
      (_, i) => `
  try
    make new attachment at newMessage with properties {file:shot${i}}
  end try
`,
    )
    .join("");

  const script = `
${attachSetup}
set bodyText to read POSIX file "${escapeAppleScript(bodyFile)}" as «class utf8»
tell application "Microsoft Outlook"
  set newMessage to make new outgoing message with properties {subject:"${escapeAppleScript(subject)}", content:bodyText}
  make new recipient at newMessage with properties {email address:{address:"${escapeAppleScript(to)}"}}
  ${attachCalls}
  send newMessage
end tell
`;
  const result = runOsascript(script);
  if (!result.ok) console.error("[proto-hub feedback] Outlook:", result.err);
  return result.ok;
}

function sendViaAppleMail(to: string, subject: string, bodyFile: string, shots: string[]): boolean {
  const attachSetup = appleScriptAttachList(shots);
  const attachCalls = shots
    .map(
      (_, i) => `
    try
      make new attachment with properties {file name:shot${i}} at after the last paragraph
    end try
`,
    )
    .join("");

  const script = `
${attachSetup}
set bodyText to read POSIX file "${escapeAppleScript(bodyFile)}" as «class utf8»
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${escapeAppleScript(subject)}", content:bodyText, visible:false}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${escapeAppleScript(to)}"}
    ${attachCalls}
    send
  end tell
end tell
`;
  const result = runOsascript(script);
  if (!result.ok) console.error("[proto-hub feedback] Mail:", result.err);
  return result.ok;
}

function revealInFinder(folder: string) {
  try {
    execFileSync("open", [folder], { timeout: 5000, stdio: "ignore" });
  } catch {
    // ignore
  }
}

/**
 * Deliver feedback when SMTP is not set up (common on designer Macs).
 * Screenshots are staged, attached to Outlook/Mail, and kept in feedback-inbox.
 */
export function deliverFeedbackLocally(options: {
  to: string;
  subject: string;
  text: string;
  id: string;
  screenshotFiles?: string[];
  smtpAttempted: boolean;
  smtpSent: boolean;
  /** When true (default), open the screenshots folder in Finder on this Mac */
  revealFolder?: boolean;
}): FeedbackDelivery {
  const { inboxFile, bodyFile, inboxDir, stagedShots } = writeInboxCopy({
    to: options.to,
    subject: options.subject,
    text: options.text,
    id: options.id,
    screenshotFiles: options.screenshotFiles || [],
  });

  const preview =
    options.text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("From:") && !l.startsWith("Account:") && !l.startsWith("When:")) ||
    "New Proto Hub feedback";

  const notifyExtra =
    stagedShots.length > 0 ? ` · ${stagedShots.length} screenshot${stagedShots.length === 1 ? "" : "s"}` : "";
  macNotification("Proto Hub feedback", `${preview}${notifyExtra}`);

  if (options.revealFolder !== false && stagedShots.length > 0) {
    revealInFinder(path.join(inboxDir, "screenshots"));
  }

  if (options.smtpSent) {
    return {
      saved: true,
      emailSent: true,
      channel: "smtp",
      detail: `Email sent to ${options.to}${stagedShots.length ? " with screenshots attached" : ""}`,
      inboxDir,
    };
  }

  if (process.platform === "darwin") {
    if (sendViaOutlook(options.to, options.subject, bodyFile, stagedShots)) {
      return {
        saved: true,
        emailSent: true,
        channel: "outlook",
        detail: `Sent with Outlook to ${options.to}${stagedShots.length ? ` (${stagedShots.length} screenshots attached)` : ""}`,
        inboxDir,
      };
    }
    if (sendViaAppleMail(options.to, options.subject, bodyFile, stagedShots)) {
      return {
        saved: true,
        emailSent: true,
        channel: "mail",
        detail: `Sent with Mail to ${options.to}${stagedShots.length ? ` (${stagedShots.length} screenshots attached)` : ""}`,
        inboxDir,
      };
    }
  }

  return {
    saved: true,
    emailSent: false,
    channel: "none",
    detail: `Saved at ${inboxFile}${stagedShots.length ? ` with ${stagedShots.length} screenshots in ${path.join(inboxDir, "screenshots")}` : ""}. Allow Proto Hub to control Outlook or Mail, or set SMTP_USER in .env.`,
    inboxDir,
  };
}
