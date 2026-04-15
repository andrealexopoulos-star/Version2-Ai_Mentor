"""Regenerate the /og-image.jpg and /twitter-image.jpg social preview
assets that go out on every share of a biqc.ai link (Step 12 / P1-7).

Why we ship this as a script rather than hand-designed assets:
  • Source Serif 4, Inter, and the Liquid Steel colour tokens are the
    brand — the social preview should match them exactly, and the
    only way to keep them in sync as the brand evolves is to regenerate
    from code.
  • The previous images were small (28 kB at 1200×630), visibly
    soft, and had weak typography — crawlers were rendering a muddy
    preview. This script doubles the working resolution (2400×1260)
    and downsamples with Pillow's LANCZOS filter to get crisp edges.
  • A reproducible command is much easier to hand over than "open
    Figma and re-export".

Usage:
    python3 scripts/generate_social_images.py

The command writes:
    frontend/public/og-image.jpg     — 1200×630 for Open Graph
    frontend/public/twitter-image.jpg — 1200×628 for Twitter summary_large_image

Both are JPEG quality=90, which is the Twitter/FB sweet spot — higher
quality gives no visible improvement at crawler display sizes but
doubles file size.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "frontend" / "public"

# Liquid Steel dark-mode token values, copied from
# frontend/src/styles/liquid-steel-tokens.css so the image stays in
# lock-step with the UI. If the tokens change, update here and re-run.
CANVAS = (8, 12, 20)           # #080C14
SURFACE = (14, 22, 40)         # #0E1628
SURFACE_RAISED = (18, 29, 48)  # #121D30

INK_DISPLAY = (237, 241, 247)  # #EDF1F7
INK = (200, 212, 228)          # #C8D4E4
INK_SECONDARY = (143, 160, 184)  # #8FA0B8
INK_MUTED = (112, 132, 153)    # #708499

LAVA = (232, 93, 0)            # #E85D00 — primary brand
LAVA_WARM = (255, 122, 26)     # #FF7A1A
LAVA_DEEP = (194, 77, 0)       # #C24D00

# Working resolution — 2× the output so the LANCZOS downsample gives
# crisp sub-pixel edges. Crawlers still display at 1200×630 or smaller,
# so anything higher than 2× is wasted bytes.
SCALE = 2
OG_W, OG_H = 1200, 630
TW_W, TW_H = 1200, 628


def _font(size: int, *, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont:
    """Best-effort font loader.

    The brand specifies Source Serif 4 for display and Inter for UI,
    but those aren't guaranteed on every build machine. We fall through
    a priority list and finally hit the bundled DejaVu Sans that ships
    with Pillow if nothing else is installed — imperfect but readable.

    Scale is applied here so callers can pass target-pixel sizes and
    get an oversized canvas font that renders cleanly after downsample.
    """
    size_scaled = size * SCALE

    candidates = []
    if serif:
        candidates = [
            # Bundled Google fonts would go here in CI; on dev macs
            # the system Georgia is a clean fallback.
            "/Library/Fonts/Georgia.ttf",
            "/System/Library/Fonts/Supplemental/Georgia.ttf",
            "/System/Library/Fonts/Times.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]

    for path in candidates:
        if os.path.exists(path):
            try:
                # .ttc requires a font index — try 0 first then fallback.
                if path.endswith(".ttc"):
                    return ImageFont.truetype(path, size_scaled, index=1 if bold else 0)
                return ImageFont.truetype(path, size_scaled)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_radial_glow(
    img: Image.Image,
    *,
    center: Tuple[int, int],
    inner_radius: int,
    outer_radius: int,
    inner_rgba: Tuple[int, int, int, int],
    outer_rgba: Tuple[int, int, int, int],
) -> None:
    """Paint a soft radial gradient onto img. Used for the lava accent
    behind the wordmark. Done in 48 concentric rings for smooth falloff
    without the artifacts of a brute-force pixel pass."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rings = 48
    for i in range(rings):
        t = i / (rings - 1)
        r = int(inner_radius + (outer_radius - inner_radius) * t)
        # Alpha fades from inner to outer.
        a = int(inner_rgba[3] + (outer_rgba[3] - inner_rgba[3]) * t)
        color = (
            int(inner_rgba[0] + (outer_rgba[0] - inner_rgba[0]) * t),
            int(inner_rgba[1] + (outer_rgba[1] - inner_rgba[1]) * t),
            int(inner_rgba[2] + (outer_rgba[2] - inner_rgba[2]) * t),
            a,
        )
        draw.ellipse(
            (center[0] - r, center[1] - r, center[0] + r, center[1] + r),
            fill=color,
        )
    # A blur pass removes the faint ring-stacking artifacts.
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=8 * SCALE))
    img.alpha_composite(overlay)


def _draw_grid(img: Image.Image, *, alpha: int = 14) -> None:
    """Faint grid overlay — reads as a subtle "data/BI" motif without
    being loud. Reinforces the brand's analytical tone."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    step = 80 * SCALE
    color = (INK_MUTED[0], INK_MUTED[1], INK_MUTED[2], alpha)
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=color, width=1)
    for y in range(0, h, step):
        draw.line([(0, y), (w, y)], fill=color, width=1)
    img.alpha_composite(overlay)


def _measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> Tuple[int, int]:
    """Return the (width, height) that `draw.text` will occupy. Uses
    textbbox for correctness — textlength ignores descenders."""
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def _render_image(width: int, height: int) -> Image.Image:
    """Compose one frame at SCALE× resolution. The caller downsamples
    to the final output dimensions."""
    W, H = width * SCALE, height * SCALE
    img = Image.new("RGBA", (W, H), CANVAS + (255,))

    # ── Background: subtle gradient from canvas to surface-raised.
    # Vertical so the headline sits against a slightly lighter band.
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        t = y / (H - 1)
        r = int(CANVAS[0] + (SURFACE_RAISED[0] - CANVAS[0]) * t)
        g = int(CANVAS[1] + (SURFACE_RAISED[1] - CANVAS[1]) * t)
        b = int(CANVAS[2] + (SURFACE_RAISED[2] - CANVAS[2]) * t)
        gd.line([(0, y), (W, y)], fill=(r, g, b, 255))
    img = Image.alpha_composite(img, grad)

    # ── Radial lava glow behind the wordmark.
    _draw_radial_glow(
        img,
        center=(int(W * 0.5), int(H * 0.48)),
        inner_radius=int(min(W, H) * 0.05),
        outer_radius=int(min(W, H) * 0.65),
        inner_rgba=(LAVA_WARM[0], LAVA_WARM[1], LAVA_WARM[2], 110),
        outer_rgba=(LAVA_DEEP[0], LAVA_DEEP[1], LAVA_DEEP[2], 0),
    )

    # ── Data-grid motif underneath everything.
    _draw_grid(img, alpha=18)

    draw = ImageDraw.Draw(img)

    # ── Top-left: small badge with lava dot + brand row.
    pad_x = 56 * SCALE
    pad_y = 52 * SCALE
    dot_r = 8 * SCALE
    draw.ellipse(
        (pad_x, pad_y + 4 * SCALE, pad_x + 2 * dot_r, pad_y + 4 * SCALE + 2 * dot_r),
        fill=LAVA + (255,),
    )
    nav_font = _font(18, bold=False)
    brand_text = "BIQc"
    draw.text(
        (pad_x + 2 * dot_r + 12 * SCALE, pad_y),
        brand_text,
        font=nav_font,
        fill=INK_DISPLAY + (255,),
    )
    # Tagline inline right of the brand — light small caps.
    tag_font = _font(13, bold=False)
    tag_text = "BUSINESS INTELLIGENCE CENTRE"
    bw, _ = _measure(draw, brand_text, nav_font)
    draw.text(
        (pad_x + 2 * dot_r + 12 * SCALE + bw + 14 * SCALE, pad_y + 4 * SCALE),
        tag_text,
        font=tag_font,
        fill=INK_MUTED + (255,),
    )

    # ── Centered display wordmark — Source Serif fallback to Georgia.
    display_font = _font(148, bold=True, serif=True)
    display_text = "BIQc"
    dw, dh = _measure(draw, display_text, display_font)
    display_x = (W - dw) // 2
    display_y = int(H * 0.33)
    draw.text(
        (display_x, display_y),
        display_text,
        font=display_font,
        fill=INK_DISPLAY + (255,),
    )

    # ── Underline accent in lava — one clean horizontal rule.
    rule_y = display_y + dh + 18 * SCALE
    rule_w = 80 * SCALE
    rule_x1 = (W - rule_w) // 2
    draw.line(
        [(rule_x1, rule_y), (rule_x1 + rule_w, rule_y)],
        fill=LAVA + (255,),
        width=3 * SCALE,
    )

    # ── Sub-headline: value prop. Keep to a single line so it reads
    # at the tiny thumbnail sizes LinkedIn/Twitter render.
    sub_font = _font(30, bold=False)
    sub_text = "AI business intelligence that learns your business."
    sw, sh = _measure(draw, sub_text, sub_font)
    draw.text(
        ((W - sw) // 2, rule_y + 24 * SCALE),
        sub_text,
        font=sub_font,
        fill=INK + (255,),
    )

    # ── Bottom supporting line: three crisp feature chips.
    chip_font = _font(16, bold=False)
    chips = ("Diagnostics", "Strategy", "Growth Planning")
    chip_sizes = [_measure(draw, c, chip_font) for c in chips]
    gap = 44 * SCALE
    total_chip_width = sum(w for w, _ in chip_sizes) + gap * (len(chips) - 1)
    chip_y = rule_y + 24 * SCALE + sh + 36 * SCALE
    x_cursor = (W - total_chip_width) // 2
    for text, (cw, ch) in zip(chips, chip_sizes):
        # Small lava dot before each chip.
        dr = 4 * SCALE
        draw.ellipse(
            (x_cursor - 10 * SCALE - dr, chip_y + 6 * SCALE, x_cursor - 10 * SCALE + dr, chip_y + 6 * SCALE + 2 * dr),
            fill=LAVA + (255,),
        )
        draw.text((x_cursor, chip_y), text, font=chip_font, fill=INK_SECONDARY + (255,))
        x_cursor += cw + gap

    # ── Bottom-right: URL. Monospace-ish UI font; lava accent on "ai".
    url_font = _font(22, bold=False)
    url_text = "biqc.ai"
    uw, uh = _measure(draw, url_text, url_font)
    url_x = W - pad_x - uw
    url_y = H - pad_y - uh
    # Use two-tone — `biqc.` in muted, `ai` in lava.
    biqc_part = "biqc."
    ai_part = "ai"
    biqc_w, _ = _measure(draw, biqc_part, url_font)
    draw.text((url_x, url_y), biqc_part, font=url_font, fill=INK_SECONDARY + (255,))
    draw.text((url_x + biqc_w, url_y), ai_part, font=url_font, fill=LAVA + (255,))

    return img


def _write(img: Image.Image, target_size: Tuple[int, int], out_path: Path) -> None:
    """Downsample to final output size and save as JPEG q=90."""
    resampled = img.resize(target_size, Image.LANCZOS)
    flat = Image.new("RGB", target_size, CANVAS)
    flat.paste(resampled, mask=resampled.split()[3] if resampled.mode == "RGBA" else None)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    flat.save(out_path, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"  → wrote {out_path} ({out_path.stat().st_size // 1024} kB)")


def main() -> int:
    print("Generating BIQc social preview images…")
    print(f"  output dir: {OUTPUT_DIR}")

    og_img = _render_image(OG_W, OG_H)
    _write(og_img, (OG_W, OG_H), OUTPUT_DIR / "og-image.jpg")

    tw_img = _render_image(TW_W, TW_H)
    _write(tw_img, (TW_W, TW_H), OUTPUT_DIR / "twitter-image.jpg")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
