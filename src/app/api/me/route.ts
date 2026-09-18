import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = getCurrentUser();
  return NextResponse.json({ user });
}
