"""Writes VinoScope's favicons (SVG, ICO, Apple touch PNG) from one shape definition.

Run once after changing the design and commit the output:
    python scripts/make_favicons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

BACKGROUND = "#231416"
GOLD = "#c9a86a"
SIZE = 64
RADIUS = 14
# Serif "V" in a 64x64 box: thick left stroke, thin right stroke, flat top serifs.
V_POLYGON = [
    (12, 14), (28, 14), (28, 16), (25, 16),
    (34.5, 41),
    (43, 16), (39, 16), (39, 14), (52, 14), (52, 16), (48.5, 16),
    (34, 51), (31, 51),
    (16, 16), (12, 16),
]
OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public"


def _svg() -> str:
    points = " ".join(f"{x:g},{y:g}" for x, y in V_POLYGON)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
        f'<rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="{BACKGROUND}"/>'
        f'<rect x="5" y="5" width="54" height="54" rx="10" fill="none" stroke="{GOLD}" stroke-opacity=".45" stroke-width="1.5"/>'
        f'<polygon points="{points}" fill="{GOLD}"/>'
        "</svg>\n"
    )


def _raster(px: int) -> Image.Image:
    # Draw at 4x and downsample for smooth edges
    scale = px * 4 / SIZE
    big = Image.new("RGBA", (px * 4, px * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    draw.rounded_rectangle([0, 0, px * 4 - 1, px * 4 - 1], radius=RADIUS * scale, fill=BACKGROUND)
    if px >= 32:  # the faint inner border is invisible at 16px; skip it there
        draw.rounded_rectangle([5 * scale, 5 * scale, 59 * scale, 59 * scale], radius=10 * scale,
                               outline=(201, 168, 106, 115), width=max(1, round(1.5 * scale)))
    draw.polygon([(x * scale, y * scale) for x, y in V_POLYGON], fill=GOLD)
    return big.resize((px, px), Image.LANCZOS)


def write_favicons(out_dir: Path = OUT_DIR) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    svg_path = out_dir / "favicon.svg"
    svg_path.write_text(_svg(), encoding="utf-8")
    png_path = out_dir / "apple-touch-icon.png"
    _raster(180).save(png_path)
    ico_path = out_dir / "favicon.ico"
    _raster(48).save(ico_path, sizes=[(16, 16), (32, 32), (48, 48)])
    return [svg_path, png_path, ico_path]


if __name__ == "__main__":
    for path in write_favicons():
        print(f"wrote {path}")
