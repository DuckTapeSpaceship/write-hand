"""Generate PWA icons into public/icons/: a handwritten "Wh" (AshFont, the v1
demo font) on a Dracula-yellow tile with the app's hard offset shadow.

    uv run --no-project --with pillow python scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BG, FG, ACCENT = "#1e1f29", "#c0caf5", "#f1fa8c"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
FONT = ROOT / "public" / "AshFont.ttf"


def tile(size: int, inset: float, transparent: bool) -> Image.Image:
    s = 4  # supersample
    n = size * s
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0) if transparent else BG)
    d = ImageDraw.Draw(im)
    pad = n * inset
    sh = n * 0.035
    box = [pad, pad, n - pad - sh, n - pad - sh]
    r = n * 0.09
    d.rounded_rectangle([box[0] + sh, box[1] + sh, box[2] + sh, box[3] + sh], r, fill=FG)
    d.rounded_rectangle(box, r, fill=ACCENT, outline=BG, width=max(2, int(n * 0.012)))
    w = box[2] - box[0]
    font = ImageFont.truetype(str(FONT), int(w * 0.62))
    tb = d.textbbox((0, 0), "Wh", font=font)
    tx = box[0] + (w - (tb[2] - tb[0])) / 2 - tb[0]
    ty = box[1] + (box[3] - box[1] - (tb[3] - tb[1])) / 2 - tb[1]
    d.text((tx, ty), "Wh", font=font, fill=BG)
    return im.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
for size in (192, 512):
    tile(size, 0.06, True).save(OUT / f"icon-{size}.png")
    # Maskable: content inside the central 80 % safe zone, full-bleed background.
    tile(size, 0.16, False).save(OUT / f"maskable-{size}.png")
tile(180, 0.08, False).convert("RGB").save(OUT / "apple-touch-icon.png")
tile(32, 0.0, True).save(OUT / "favicon-32.png")
print("wrote", sorted(p.name for p in OUT.iterdir()))
