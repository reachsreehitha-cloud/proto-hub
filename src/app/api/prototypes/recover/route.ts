import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recoverOrphanedDesktopPrototypes } from "@/lib/store";

/** Re-list Blueprint folders on Desktop that vanished from Proto Hub’s registry. */
export async function POST() {
  const user = getCurrentUser();
  const recovered = recoverOrphanedDesktopPrototypes({
    name: user.name,
    email: user.email,
  });

  return NextResponse.json({
    ok: true,
    recovered: recovered.length,
    prototypes: recovered,
  });
}
