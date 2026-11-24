import sys, math
# Maakt icons/icon{16,32,48,128}.png voor Docentdeck: een tegel in indigo-violet met een waaier van kaarten.
# Gebruik: python3 scripts/make-icons.py icons   (vereist Pillow)
from PIL import Image, ImageDraw, ImageFilter, ImageChops
out = sys.argv[1]
N = 1024

def squircle_mask(n, inset, k=5.0):
    m = Image.new("L", (n, n), 0); d = ImageDraw.Draw(m)
    c = n / 2; r = n / 2 - inset; pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720; ct, st = math.cos(t), math.sin(t)
        pts.append((c + r * math.copysign(abs(ct) ** (2 / k), ct), c + r * math.copysign(abs(st) ** (2 / k), st)))
    d.polygon(pts, fill=255); return m

def diaggrad(n, a, b):
    g = Image.new("RGB", (n, n)); px = g.load()
    for y in range(0, n, 4):
        for x in range(0, n, 4):
            t = (x + y) / (2 * n - 2)
            col = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
            for dy in range(4):
                for dx in range(4):
                    if x + dx < n and y + dy < n: px[x + dx, y + dy] = col
    return g

def kaart(w, h, r, kleur, hoek, inhoud=None):
    """Afgeronde kaart, gedraaid om haar midden; inhoud tekent op de ongedraaide kaart."""
    k = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0)); d = ImageDraw.Draw(k)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=kleur)
    if inhoud: inhoud(d, w, h)
    return k.rotate(hoek, resample=Image.BICUBIC, expand=True)

def plak(img, laag, cx, cy, schaduw=True):
    x, y = int(cx - laag.width / 2), int(cy - laag.height / 2)
    if schaduw:
        s = Image.new("RGBA", laag.size, (20, 10, 60, 0)); s.putalpha(laag.getchannel("A").point(lambda v: v * 0.35))
        s = s.filter(ImageFilter.GaussianBlur(N * 0.02))
        img.alpha_composite(s, (x, y + int(N * 0.02)))
    img.alpha_composite(laag, (x, y))

def render(size):
    klein = size < 48
    inset = N * 0.06 if not klein else N * 0.02
    mask = squircle_mask(N, inset)
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    img.paste(diaggrad(N, (99, 91, 255), (124, 58, 237)).convert("RGBA"), (0, 0), mask)
    if not klein:   # zachte glans bovenaan
        hl = Image.new("L", (N, N), 0); ImageDraw.Draw(hl).ellipse((-N * .25, -N * .8, N * 1.25, N * .38), fill=45)
        hl = ImageChops.multiply(hl.filter(ImageFilter.GaussianBlur(N * .05)), mask)
        w = Image.new("RGBA", (N, N), (255, 255, 255, 0)); w.putalpha(hl); img = Image.alpha_composite(img, w)
    W, H, R = N * (0.40 if not klein else 0.46), N * (0.52 if not klein else 0.58), N * 0.06
    def voorkant(d, w, h):
        m = w * 0.14
        d.rounded_rectangle((m, m, w - m, m + h * 0.16), radius=h * 0.05, fill=(255, 122, 89))   # accentbalk (koraal)
        if not klein:
            for i, f in enumerate((0.86, 0.66, 0.76)):
                y = m + h * 0.30 + i * h * 0.15
                d.rounded_rectangle((m, y, m + (w - 2 * m) * f, y + h * 0.065), radius=h * 0.03, fill=(205, 200, 235))
    if not klein:
        plak(img, kaart(W, H, R, (255, 255, 255, 110), 16), N * 0.40, N * 0.52)
    plak(img, kaart(W, H, R, (255, 255, 255, 170), 7), N * 0.46, N * 0.51, schaduw=not klein)
    plak(img, kaart(W, H, R, (255, 255, 255, 255), -6, voorkant), N * 0.55, N * 0.50, schaduw=not klein)
    return img.resize((size, size), Image.LANCZOS)

for s in (16, 32, 48, 128):
    render(s).save(f"{out}/icon{s}.png")
    print("icon", s)
