import { NextResponse } from "next/server";
import { createComment, getComments, getPrototype } from "@/lib/store";
import { extractMentions } from "@/lib/mentions";
import { sendMentionEmails } from "@/lib/email";
import type { CreateCommentInput } from "@/lib/types";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }
  return NextResponse.json({ comments: getComments(prototype.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prototype = getPrototype(id);
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  const body = (await request.json()) as CreateCommentInput;
  if (!body.body?.trim() || !body.author?.trim() || !body.authorEmail?.trim()) {
    return NextResponse.json({ error: "Comment body and author are required." }, { status: 400 });
  }

  const mentions = extractMentions(body.body);
  const comment = createComment(prototype.id, body, mentions);
  await sendMentionEmails(prototype, comment, mentions);

  return NextResponse.json({ comment }, { status: 201 });
}
