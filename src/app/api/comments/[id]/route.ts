import { NextResponse } from "next/server";
import { updateCommentStatus } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const comment = updateCommentStatus(id, body.status);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  return NextResponse.json({ comment });
}
