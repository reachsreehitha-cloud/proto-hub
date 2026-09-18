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
    if (!email.includes("@")) continue;
    try {
      if (process.env.SMTP_USER) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || "proto-hub@netapp.com",
          to: email,
          subject,
          text,
          html: `
            <p><strong>${comment.author}</strong> mentioned you on <strong>${prototype.name}</strong>:</p>
            <blockquote style="border-left:3px solid #8b5cf6;padding-left:12px;color:#444">${comment.body}</blockquote>
            <p>Screen: <code>${comment.route}</code></p>
            <p><a href="${link}" style="background:#8b5cf6;color:white;padding:10px 16px;border-radius:8px;text-decoration:none">View feedback</a></p>
          `,
        });
      } else {
        console.log(`[proto-hub email preview] To: ${email}\nSubject: ${subject}\n${text}`);
      }
    } catch (error) {
      console.error("Failed to send mention email:", error);
    }
  }
}
