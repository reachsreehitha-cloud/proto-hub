import { NextResponse } from "next/server";
import { getPrototypes } from "@/lib/store";
import { getTeamGalleryPrototypes } from "@/lib/teamRegistry";

export async function GET() {
  const prototypes = await getTeamGalleryPrototypes(getPrototypes());
  return NextResponse.json({ prototypes });
}
