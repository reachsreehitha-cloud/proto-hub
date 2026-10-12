import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type FeedbackDelivery = {
  saved: boolean;
  emailSent: boolean;
  channel: "smtp" | "outlook" | "mail" | "none";
  detail: string;
};

function escapeAppleScript(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function runOsascript(source: string): { ok: boolean; err?: string } {
  try {
    execFileSync("osascript", ["-e", source], {
      encoding: "utf8",
      timeout: 25000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, err: message.slice(0, 240) };
  }
}

function macNotification(title: string, body: string) {
  const t = escapeAppleScript(title.slice(0, 80));
  const b = escapeAppleScript(body.slice(0, 180).replace(/\n/g, " "));
  runOsascript(
    `display notification "${b}" with title "${t}" sound name "Glass"`,
  );
}

function writeInboxCopy(options: {
  to: string;
  subject: string;
  text: string;
  id: string;
}): { inboxFile: string; bodyFile: string } {
  const dir = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Proto Hub",
    "feedback-inbox",
  );
  fs.mkdirSync(dir, { recursive: true });
  const inboxFile = path.join(dir, `${options.id}.txt`);
  const bodyFile = path.join(dir, `${options.id}-body.txt`);
  fs.writeFileSync(
    inboxFile,
    [`To: ${options.to}`, `Subject: ${options.subject}`, "", options.text, ""].join("\n"),
  );
  fs.writeFileSync(bodyFile, options.text);
  fs.writeFileSync(path.join(dir, "LATEST.txt"), fs.readFileSync(inboxFile));
  return { inboxFile, bodyFile };
}

function sendViaOutlook(to: string, subject: string, bodyFile: string): boolean {
  const script = `
set bodyText to read POSIX file "${escapeAppleScript(bodyFile)}" as «class utf8»
tell application "Microsoft Outlook"
  set newMessage to make new outgoing message with properties {subject:"${escapeAppleScript(subject)}", content:bodyText}
  make new recipient at newMessage with properties {email address:{address:"${escapeAppleScript(to)}"}}
  send newMessage
end tell
`;
  const result = runOsascript(script);
  if (!result.ok) console.error("[proto-hub feedback] Outlook:", result.err);
  return result.ok;
}

function sendViaAppleMail(to: string, subject: string, bodyFile: string): boolean {
  const script = `
set bodyText to read POSIX file "${escapeAppleScript(bodyFile)}" as «class utf8»
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${escapeAppleScript(subject)}", content:bodyText, visible:false}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${escapeAppleScript(to)}"}
    send
  end tell
end tell
`;
  const result = runOsascript(script);
  if (!result.ok) console.error("[proto-hub feedback] Mail:", result.err);
  return result.ok;
}

/**
 * Deliver feedback when SMTP is not set up (common on designer Macs).
 * Order: save local inbox copy → Notification Center → Outlook → Apple Mail.
 */
export function deliverFeedbackLocally(options: {
  to: string;
  subject: string;
  text: string;
  id: string;
  smtpAttempted: boolean;
  smtpSent: boolean;
}): FeedbackDelivery {
  const { inboxFile, bodyFile } = writeInboxCopy(options);
  const preview =
    options.text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("From:") && !l.startsWith("Account:") && !l.startsWith("When:")) ||
    "New Proto Hub feedback";

  macNotification("Proto Hub feedback", preview);

  if (options.smtpSent) {
    return {
      saved: true,
      emailSent: true,
      channel: "smtp",
      detail: `Email sent to ${options.to}`,
    };
  }

  if (process.platform === "darwin") {
    if (sendViaOutlook(options.to, options.subject, bodyFile)) {
      return {
        saved: true,
        emailSent: true,
        channel: "outlook",
        detail: `Sent with Outlook to ${options.to}`,
      };
    }
    if (sendViaAppleMail(options.to, options.subject, bodyFile)) {
      return {
        saved: true,
        emailSent: true,
        channel: "mail",
        detail: `Sent with Mail to ${options.to}`,
      };
    }
  }

  return {
    saved: true,
    emailSent: false,
    channel: "none",
    detail: `Saved locally at ${inboxFile}. Allow Proto Hub to control Outlook or Mail (System Settings → Privacy & Security → Automation), or set SMTP_USER in .env.`,
  };
}
