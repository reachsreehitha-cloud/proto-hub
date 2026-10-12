#!/usr/bin/env python3
"""Generate Proto Hub Dock + menu-bar icons (macOS optical sizing)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent

# Electric mint that reads on dark Dock / menu bar (brighter than old teal)
ACCENT = (0, 255, 194, 255)  # #00FFC2
ACCENT_SOFT = (0, 255, 194, 90)
INK = (8, 14, 24, 255)  # deep ink for mark contrast
FACE = (18, 28, 42, 255)  # charcoal face (matches modern macOS tiles)
FACE_EDGE = (36, 52, 74, 255)
HIGHLIGHT = (255, 255, 255, 28)


def rounded_rect_mask(size: int, radius: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_hub_mark(draw: ImageDraw.ImageDraw, cx: float, cy: float, scale: float) -> None:
    """Connected-node hub mark — reads as Proto Hub, not a green hole."""
    r_outer = 0.34 * scale
    r_hub = 0.11 * scale
    r_node = 0.065 * scale
    stroke = max(2.0, 0.055 * scale)

    # Orbit ring
    bbox = [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer]
    draw.ellipse(bbox, outline=ACCENT, width=int(round(stroke)))

    # Three satellite nodes (120°) + spokes — "hub"
    for i in range(3):
        ang = -math.pi / 2 + i * (2 * math.pi / 3)
        nx = cx + math.cos(ang) * r_outer
        ny = cy + math.sin(ang) * r_outer
        draw.line((cx, cy, nx, ny), fill=ACCENT, width=int(round(stroke)))
        draw.ellipse(
            [nx - r_node, ny - r_node, nx + r_node, ny + r_node],
            fill=ACCENT,
        )

    # Center node with ink core for pop
    draw.ellipse(
        [cx - r_hub, cy - r_hub, cx + r_hub, cy + r_hub],
        fill=ACCENT,
    )
    inner = r_hub * 0.42
    draw.ellipse(
        [cx - inner, cy - inner, cx + inner, cy + inner],
        fill=INK,
    )


def make_app_icon(size: int = 1024) -> Image.Image:
    """Full macOS app icon with transparent padding so Dock size matches peers."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Optical padding ~12% — full-bleed icons look oversized next to system apps
    pad = int(size * 0.12)
    face = size - 2 * pad
    # Continuous-corner squircle-ish radius (~22% of face, macOS-like)
    radius = face * 0.223

    face_img = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    mask = rounded_rect_mask(face, radius)

    # Soft gradient face
    base = Image.new("RGBA", (face, face), FACE)
    grad = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(face):
        t = y / max(face - 1, 1)
        r = int(FACE[0] + (FACE_EDGE[0] - FACE[0]) * t)
        g = int(FACE[1] + (FACE_EDGE[1] - FACE[1]) * t)
        b = int(FACE[2] + (FACE_EDGE[2] - FACE[2]) * t)
        gd.line([(0, y), (face, y)], fill=(r, g, b, 255))
    base = Image.alpha_composite(base, grad)

    # Top sheen
    sheen = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.ellipse(
        (-face * 0.15, -face * 0.55, face * 1.15, face * 0.55),
        fill=HIGHLIGHT,
    )
    sheen = sheen.filter(ImageFilter.GaussianBlur(radius=face * 0.04))
    base = Image.alpha_composite(base, sheen)

    # Accent glow behind mark
    glow = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    gl = ImageDraw.Draw(glow)
    gcx, gcy = face / 2, face / 2
    gr = face * 0.28
    gl.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], fill=ACCENT_SOFT)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=face * 0.08))
    base = Image.alpha_composite(base, glow)

    mark = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    draw_hub_mark(ImageDraw.Draw(mark), face / 2, face / 2, face)
    base = Image.alpha_composite(base, mark)

    # Apply squircle mask
    out_face = Image.new("RGBA", (face, face), (0, 0, 0, 0))
    out_face.paste(base, (0, 0), mask)

    img.paste(out_face, (pad, pad), out_face)
    return img


def make_tray_icon(size: int, template: bool = False) -> Image.Image:
    """Menu-bar glyph with padding so it doesn't dwarf Wi‑Fi / Control Center."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Extra inset vs old full-bleed circle
    pad = size * 0.18
    scale = size - 2 * pad
    cx = cy = size / 2

    if template:
        # Template images: opaque black shape, macOS tints it
        color = (0, 0, 0, 255)
        r_outer = 0.36 * scale
        r_hub = 0.12 * scale
        r_node = 0.07 * scale
        stroke = max(1, int(round(0.08 * scale)))
        draw.ellipse(
            [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
            outline=color,
            width=stroke,
        )
        for i in range(3):
            ang = -math.pi / 2 + i * (2 * math.pi / 3)
            nx = cx + math.cos(ang) * r_outer
            ny = cy + math.sin(ang) * r_outer
            draw.line((cx, cy, nx, ny), fill=color, width=stroke)
            draw.ellipse([nx - r_node, ny - r_node, nx + r_node, ny + r_node], fill=color)
        draw.ellipse([cx - r_hub, cy - r_hub, cx + r_hub, cy + r_hub], fill=color)
        return img

    draw_hub_mark(draw, cx, cy, scale * 1.05)
    return img


def main() -> None:
    app = make_app_icon(1024)
    app_path = ROOT / "AppIcon.png"
    app.save(app_path, "PNG")
    print(f"wrote {app_path}")

    # Also keep a 512 master used by Electron copy path
    app.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / "AppIcon-512.png", "PNG")

    for name, size, template in [
        ("TrayIcon.png", 22, False),
        ("TrayIcon@2x.png", 44, False),
        ("IconTemplate.png", 22, True),
        ("IconTemplate@2x.png", 44, True),
    ]:
        out = ROOT / name
        make_tray_icon(size, template=template).save(out, "PNG")
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
