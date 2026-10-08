import { NextResponse } from "next/server";
import { isSharedLocalPreview } from "@/lib/coverPlaceholder";
import { isPreviewReachable, resolveAutoPreviewUrl } from "@/lib/preview";
import { getPrototype, getPrototypes } from "@/lib/store";
import { getTeamGalleryPrototypes } from "@/lib/teamRegistry";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let prototype = getPrototype(id);
  if (!prototype) {
    // Team gallery cards use registry-* ids that are not in local drafts
    const gallery = await getTeamGalleryPrototypes(getPrototypes());
    prototype = gallery.find((p) => p.id === id || p.slug === id);
  }
  if (!prototype) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }

  if (prototype.coverMode === "custom" && prototype.coverImage) {
    return NextResponse.json({
      mode: "custom",
      coverImage: prototype.coverImage,
      reachable: true,
    });
  }

  // Published ux.netapp.com URL (unique per prototype)
  if (
    prototype.status === "published" &&
    prototype.previewUrl &&
    !isSharedLocalPreview(prototype.previewUrl)
  ) {
    const reachable = await isPreviewReachable(prototype.previewUrl);
    return NextResponse.json({
      mode: "auto",
      url: prototype.previewUrl,
      reachable,
      isLocal: false,
      localPort: prototype.localPort ?? null,
    });
  }

  // Draft: this prototype's own localhost port only (5173, 5174, …)
  const localUrl = resolveAutoPreviewUrl(prototype);
  const reachable = await isPreviewReachable(localUrl);

  return NextResponse.json({
    mode: "auto",
    url: localUrl,
    reachable,
    isLocal: true,
    localPort: prototype.localPort ?? null,
  });
}
