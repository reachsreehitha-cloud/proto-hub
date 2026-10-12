import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { HELP_REPORT_EMAIL } from "@/lib/publishGuide";
import { sendHelpIssueReport } from "@/lib/email";

type ShotIn = { name?: string; dataUrl?: string };

type ReportBody = {
  whatHappened?: string;
  /** @deprecated older clients */
  summary?: string;
  details?: string;
  screenshots?: ShotIn[];
};

const MAX_SHOTS = 6;
const MAX_DATA_URL_CHARS = 1_800_000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ReportBody;
  const whatHappened = String(body.whatHappened || body.summary || "").trim();
  const legacyDetails = String(body.details || "").trim();
  const fullText = [whatHappened, legacyDetails].filter(Boolean).join("\n\n");

  if (!fullText) {
    return NextResponse.json({ error: "Say what happened." }, { status: 400 });
  }

  const screenshots = (Array.isArray(body.screenshots) ? body.screenshots : [])
    .filter(
      (s): s is { name: string; dataUrl: string } =>
        Boolean(s?.dataUrl?.startsWith("data:image/") && s.dataUrl.length < MAX_DATA_URL_CHARS),
    )
    .slice(0, MAX_SHOTS)
    .map((s, i) => ({
      name: String(s.name || `screenshot-${i + 1}.png`).slice(0, 120),
      dataUrl: s.dataUrl,
    }));

  const user = getCurrentUser();
  const report = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    whatHappened: fullText,
    screenshotCount: screenshots.length,
    screenshotNames: screenshots.map((s) => s.name),
    fromName: user.name,
    fromEmail: user.email,
    accountId: user.accountId,
  };

  const dataDir = path.join(process.cwd(), "data");
  const file = path.join(dataDir, "issue-reports.json");
  const shotsDir = path.join(dataDir, "issue-screenshots", report.id);
  const screenshotFiles: string[] = [];

  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (screenshots.length > 0) {
      fs.mkdirSync(shotsDir, { recursive: true });
      screenshots.forEach((shot, i) => {
        const match = shot.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) return;
        const ext = match[1].includes("png")
          ? "png"
          : match[1].includes("jpeg") || match[1].includes("jpg")
            ? "jpg"
            : match[1].includes("webp")
              ? "webp"
              : "img";
        const safe =
          shot.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || `shot-${i + 1}.${ext}`;
        const filename = safe.endsWith(`.${ext}`) ? safe : `${safe}.${ext}`;
        const dest = path.join(shotsDir, filename);
        fs.writeFileSync(dest, Buffer.from(match[2], "base64"));
        screenshotFiles.push(dest);
      });
    }

    const existing = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown[])
      : [];
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      ...report,
      screenshotFiles,
      screenshotsDir: screenshotFiles.length ? shotsDir : "",
    });
    fs.writeFileSync(file, `${JSON.stringify(list.slice(0, 200), null, 2)}\n`);
  } catch (err) {
    console.error("Could not write issue report:", err);
  }

  const delivery = await sendHelpIssueReport({
    to: HELP_REPORT_EMAIL,
    report: {
      id: report.id,
      at: report.at,
      whatHappened: report.whatHappened,
      fromName: report.fromName,
      fromEmail: report.fromEmail,
      accountId: report.accountId,
      screenshotNames: report.screenshotNames,
      screenshotFiles,
    },
  });

  return NextResponse.json({
    ok: true,
    emailSent: delivery.emailSent,
    channel: delivery.channel,
    inboxDir: delivery.inboxDir,
    screenshotCount: screenshotFiles.length,
    message: delivery.emailSent
      ? `Thanks. Sent to ${HELP_REPORT_EMAIL}${
          screenshotFiles.length ? ` with ${screenshotFiles.length} screenshot(s).` : "."
        }`
      : `Thanks. Saved. ${delivery.detail}`,
  });
}
