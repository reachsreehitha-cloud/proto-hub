import nodemailer from "nodemailer";
import type { Comment, Prototype } from "./types";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

function reviewUrl(prototype: Prototype, comment: Comment) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    comment: comment.id,
    route: comment.route,
  });
  return `${base}/review/${prototype.id}?${params.toString()}`;
}

async function sendOne(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (!options.to.includes("@")) return;
  try {
    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "proto-hub@netapp.com",
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } else {
      console.log(
        `[proto-hub email preview] To: ${options.to}\nSubject: ${options.subject}\n${options.text}`,
      );
    }
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendMentionEmails(
  prototype: Prototype,
  comment: Comment,
  mentionedEmails: string[],
) {
  if (mentionedEmails.length === 0) return;

  const link = reviewUrl(prototype, comment);
  const subject = `${comment.author} mentioned you on "${prototype.name}"`;
  const text = [
    `${comment.author} left feedback on ${prototype.name}:`,
    "",
    comment.body,
    "",
    `View at: ${link}`,
    `Screen: ${comment.route}`,
  ].join("\n");

  for (const email of mentionedEmails) {
    await sendOne({
      to: email,
      subject,
      text,
      html: `
        <p><strong>${comment.author}</strong> mentioned you on <strong>${prototype.name}</strong>:</p>
        <blockquote style="border-left:3px solid #8b5cf6;padding-left:12px;color:#444">${comment.body}</blockquote>
        <p>Screen: <code>${comment.route}</code></p>
        <p><a href="${link}" style="background:#8b5cf6;color:white;padding:10px 16px;border-radius:8px;text-decoration:none">View feedback</a></p>
        <p style="color:#888;font-size:12px">You’re getting this because you were @mentioned.</p>
      `,
    });
  }
}

/** Help → Report feedback (logs to console when SMTP is unset). */
export async function sendHelpIssueReport(options: {
  to: string;
  report: {
    id: string;
    at: string;
    whatHappened: string;
    fromName: string;
    fromEmail: string;
    accountId?: string;
    screenshotNames?: string[];
    screenshotPaths?: string;
  };
}) {
  const { report, to } = options;
  const firstLine =
    report.whatHappened.split("\n").find((l) => l.trim())?.trim().slice(0, 80) || "Feedback";
  const subject = `[Proto Hub feedback] ${firstLine}`;
  const shots =
    report.screenshotNames && report.screenshotNames.length > 0
      ? `Screenshots (${report.screenshotNames.length}): ${report.screenshotNames.join(", ")}${
          report.screenshotPaths ? `\nSaved under: ${report.screenshotPaths}` : ""
        }`
      : "No screenshots";

  const text = [
    `From: ${report.fromName} <${report.fromEmail}>`,
    report.accountId ? `Account: ${report.accountId}` : "",
    `When: ${report.at}`,
    "",
    report.whatHappened,
    "",
    shots,
    "",
    `Report id: ${report.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendOne({
    to,
    subject,
    text,
    html: `
      <p><strong>${report.fromName}</strong> &lt;${report.fromEmail}&gt;${
        report.accountId ? ` · ${report.accountId}` : ""
      }</p>
      <pre style="white-space:pre-wrap;font-family:inherit;color:#444">${report.whatHappened}</pre>
      <p style="color:#666;font-size:13px">${shots.replace(/\n/g, "<br/>")}</p>
      <p style="color:#888;font-size:12px">${report.id} · ${report.at}</p>
    `,
  });
}

/** Notify people watching the prototype (skips commenter + already-@mentioned). */
export async function sendWatcherEmails(
  prototype: Prototype,
  comment: Comment,
  watcherEmails: string[],
  alreadyNotified: string[] = [],
) {
  const skip = new Set(
    [...alreadyNotified, comment.authorEmail]
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  const recipients = watcherEmails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && !skip.has(e));

  if (recipients.length === 0) return;

  const link = reviewUrl(prototype, comment);
  const unsubHint = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/review/${prototype.id}`;
  const subject = `New comment on "${prototype.name}"`;
  const text = [
    `${comment.author} commented on ${prototype.name}:`,
    "",
    comment.body,
    "",
    `View at: ${link}`,
    `Screen: ${comment.route}`,
    "",
    `To stop comment emails to your inbox only: open the review page and click “Stop my emails”.`,
    unsubHint,
  ].join("\n");

  for (const email of recipients) {
    await sendOne({
      to: email,
      subject,
      text,
      html: `
        <p><strong>${comment.author}</strong> commented on <strong>${prototype.name}</strong>:</p>
        <blockquote style="border-left:3px solid #52525b;padding-left:12px;color:#444">${comment.body}</blockquote>
        <p>Screen: <code>${comment.route}</code></p>
        <p><a href="${link}" style="background:#18181b;color:white;padding:10px 16px;border-radius:8px;text-decoration:none">View feedback</a></p>
        <p style="color:#888;font-size:12px">
          These emails go to your inbox only.
          <a href="${unsubHint}">Open review → Stop my emails</a> if you no longer want them.
        </p>
      `,
    });
  }
}
