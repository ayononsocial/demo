"""Regenerates every icon, splash and store graphic from brand/logo.png (crest + red LEGACY wordmark).
Run from the repo root:  python3 brand/make_icons.py   (needs Pillow)"""
import os
from PIL import Image, ImageDraw, ImageChops
BG = (228, 226, 221)
logo = Image.open("brand/logo.png").convert("RGBA")
W, H = logo.size
# 1) knock out the flat grey background (flood fill from the corner; the crest's black outline keeps its inside)
probe = logo.convert("RGB"); ImageDraw.floodfill(probe, (0, 0), (255, 0, 255), thresh=14)
r, g, b = probe.split()
bg = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)), b.point(lambda v: 255 if v == 255 else 0))
alpha = ImageChops.invert(bg)
cut = logo.copy(); cut.putalpha(alpha)
crest_box = alpha.crop((0, 0, W, int(H * 0.77))).getbbox()
crest = cut.crop(crest_box)                      # shield only, transparent background
full = cut.crop(alpha.getbbox())                 # shield + LEGACY wordmark
sil = Image.new("RGBA", crest.size, (255, 255, 255, 0)); sil.putalpha(crest.split()[3])   # white silhouette for notifications

def fit(img, box_w, box_h):
    s = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
def place(canvas, img, scale_h, scale_w=None):
    im = fit(img, canvas.width * (scale_w or scale_h), canvas.height * scale_h)
    canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2)); return canvas
def solid(w, h, c): return Image.new("RGBA", (w, h), c + (255,))
def icon_sq(w, scale=0.8, c=(255, 255, 255)): return place(solid(w, w, c), crest, scale)
def round_icon(w):
    im = icon_sq(w, 0.74); m = Image.new("L", (w, w), 0); ImageDraw.Draw(m).ellipse((0, 0, w - 1, w - 1), fill=255)
    out = Image.new("RGBA", (w, w), (0, 0, 0, 0)); out.paste(im, (0, 0), m); return out
def foreground(w): return place(Image.new("RGBA", (w, w), (0, 0, 0, 0)), crest, 0.56)
def crest_pad(w, h=None): return place(Image.new("RGBA", (w, w), (0, 0, 0, 0)), crest, 0.94)
def notif(w): return place(Image.new("RGBA", (w, w), (0, 0, 0, 0)), sil, 0.9)
def splash(w, h, dark): return place(solid(w, h, (20, 20, 22) if dark else (248, 246, 244)), crest, 0.26)
def banner(w, h): return place(solid(w, h, BG), full, 0.78, 0.7)

def save(path, make, rgb=False):
    size = Image.open(path).size if os.path.exists(path) else None
    if not size: print("skip (missing)", path); return
    im = make(*size); (im.convert("RGB") if rgb else im).save(path); print("wrote", path, size)
A = "app/android/app/src/main/res"
for f, mk in [("logo-mark.png", crest_pad), ("favicon-32.png", crest_pad), ("icons/apple-touch-icon.png", lambda w, h: icon_sq(w, .8)),
              ("icons/icon-192.png", lambda w, h: icon_sq(w, .8)), ("icons/icon-512.png", lambda w, h: icon_sq(w, .8)),
              ("icons/maskable-512.png", lambda w, h: icon_sq(w, .6)), ("og-image.png", banner)]:
    save("app/public/" + f, mk)
save("app/assets/icon-only.png", lambda w, h: icon_sq(w, .8)); save("app/assets/icon-foreground.png", lambda w, h: foreground(w))
save("app/assets/icon-background.png", lambda w, h: solid(w, h, (255, 255, 255))); save("app/assets/ic_stat_notify.png", lambda w, h: notif(w))
save("app/assets/splash.png", lambda w, h: splash(w, h, False)); save("app/assets/splash-dark.png", lambda w, h: splash(w, h, True))
save("store/graphics/appstore-icon-1024.png", lambda w, h: icon_sq(w, .8), rgb=True); save("store/graphics/play-icon-512.png", lambda w, h: icon_sq(w, .8))
save("store/graphics/feature-graphic-1024x500.png", banner, rgb=True)
for d in sorted(os.listdir(A)):
    for f in sorted(os.listdir(os.path.join(A, d))):
        p = os.path.join(A, d, f)
        if not f.endswith(".png"): continue
        if d.startswith("mipmap"):
            mk = {"ic_launcher.png": lambda w, h: icon_sq(w, .8), "ic_launcher_round.png": lambda w, h: round_icon(w),
                  "ic_launcher_foreground.png": lambda w, h: foreground(w), "ic_launcher_background.png": lambda w, h: solid(w, h, (255, 255, 255))}.get(f)
        elif f == "splash.png": mk = lambda w, h, n=("night" in d): splash(w, h, n)
        elif f == "ic_stat_notify.png": mk = lambda w, h: notif(w)
        else: mk = None
        if mk: save(p, mk)
