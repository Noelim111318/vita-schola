#!/usr/bin/env python3
"""Genere les icones : monogramme "VS" (Vita Schola) jaune, V et S imbriques,
sur un fond bleu nuit uni — a plat, sans decor (dans l'esprit des icones de
Pronote ou Papillon). Couleurs reprises de l'app (voir :root dans app.css).

Sorties (webapp/) :
    icons/icon-192.png
    icons/icon-512.png
    icons/icon-512-maskable.png   (fond plein bord a bord + marge de securite)
    icons/apple-touch-icon.png    (180x180, opaque)
    favicon.ico                   (16 / 32 / 48 / 64)

Et, si android/ existe (cap add android execute) — l'icone du lanceur
Android, un systeme de ressources separe des icones PWA ci-dessus :
    android/.../res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
        ic_launcher.png            (legacy carre)
        ic_launcher_round.png      (legacy rond, API < 26)
        ic_launcher_foreground.png (icone adaptative, API >= 26)
    android/.../res/values/ic_launcher_background.xml (couleur de fond)

Depend de Pillow :  python3 -m pip install pillow
"""
import os
import urllib.request

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("Pillow requis :  python3 -m pip install pillow")

try:
    LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    LANCZOS = Image.LANCZOS

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
WEBAPP = os.path.join(REPO_ROOT, "webapp")
ICONS = os.path.join(WEBAPP, "icons")
FONT = os.path.join(HERE, "Nunito.ttf")
FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nunito/Nunito%5Bwght%5D.ttf"

S = 2048
BG = (19, 30, 48)
INK = (255, 209, 102)
WEIGHT = 1000

GLYPH_SCALE = 0.56
OVERLAP = 0.30
S_DROP = 0.10
GAP = 0.035
SAFE = 0.68
MASKABLE = 0.85
CORNER = 0.22


def _font(px):
    if not os.path.exists(FONT):
        try:
            print("Telechargement de Nunito (une fois)...")
            urllib.request.urlretrieve(FONT_URL, FONT)
        except Exception as e:
            raise SystemExit(
                "Impossible de telecharger la police (%s).\n"
                "Options : se connecter le temps du 1er run, OU deposer une police\n"
                "TrueType lisible sous  %s" % (e, FONT)
            )
    f = ImageFont.truetype(FONT, px)
    try:
        f.set_variation_by_axes([WEIGHT])
    except Exception:
        pass
    return f


def monogram_mask(scale=1.0):
    """Masque (L) du monogramme : V, puis S decale vers le bas qui chevauche le
    bras droit du V, detoure d'un lisere vide pour que les 2 lettres restent
    distinctes. Sans couleur : sert aussi bien sur fond plein que transparent."""
    f = _font(int(S * GLYPH_SCALE * scale))
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    bv = probe.textbbox((0, 0), "V", font=f)
    bs = probe.textbbox((0, 0), "S", font=f)
    wv, ws = bv[2] - bv[0], bs[2] - bs[0]
    ov = wv * OVERLAP
    x = S / 2 - (wv + ws - ov) / 2
    h = max(bv[3], bs[3]) - min(bv[1], bs[1])
    y = S / 2 - h / 2 - min(bv[1], bs[1])
    sx, sy = x + wv - ov - bs[0], y + h * S_DROP

    v = Image.new("L", (S, S), 0)
    ImageDraw.Draw(v).text((x - bv[0], y), "V", font=f, fill=255)
    s = Image.new("L", (S, S), 0)
    ImageDraw.Draw(s).text((sx, sy), "S", font=f, fill=255)
    halo = Image.new("L", (S, S), 0)
    ImageDraw.Draw(halo).text((sx, sy), "S", font=f, fill=255,
                              stroke_width=int(S * GAP * scale), stroke_fill=255)
    return ImageChops.lighter(ImageChops.subtract(v, halo), s)


def compose(size, scale=1.0, shape=None, background=True):
    """shape : None (carre plein), "rounded" ou "circle" (coins transparents)."""
    img = Image.new("RGBA", (S, S), BG + (255,) if background else (0, 0, 0, 0))
    img.paste(INK + (255,), (0, 0), monogram_mask(scale))
    if shape:
        m = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(m)
        if shape == "circle":
            d.ellipse([0, 0, S - 1, S - 1], fill=255)
        else:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * CORNER), fill=255)
        img.putalpha(m)
    img = img.resize((size, size), LANCZOS)
    return img if shape or not background else img.convert("RGB")


ANDROID_DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def write_android_icons():
    android_res = os.path.join(REPO_ROOT, "android", "app", "src", "main", "res")
    if not os.path.isdir(android_res):
        print("android/ introuvable (cap add android pas encore fait) — icones Android ignorees.")
        return
    for density, size in ANDROID_DENSITIES.items():
        d = os.path.join(android_res, "mipmap-" + density)
        os.makedirs(d, exist_ok=True)
        compose(size, shape="rounded").save(os.path.join(d, "ic_launcher.png"))
        compose(size, shape="circle").save(os.path.join(d, "ic_launcher_round.png"))
        compose(size * 9 // 4, scale=SAFE, background=False).save(
            os.path.join(d, "ic_launcher_foreground.png"))
    bg_xml = os.path.join(android_res, "values", "ic_launcher_background.xml")
    if os.path.exists(bg_xml):
        with open(bg_xml, "w") as f:
            f.write(
                '<?xml version="1.0" encoding="utf-8"?>\n'
                '<resources>\n'
                '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n'
                '</resources>\n' % BG
            )
    print("Icones Android (mipmap-mdpi..xxxhdpi) regenerees + fond adaptatif mis a jour.")


def main():
    os.makedirs(ICONS, exist_ok=True)
    compose(192, shape="rounded").save(os.path.join(ICONS, "icon-192.png"))
    compose(512, shape="rounded").save(os.path.join(ICONS, "icon-512.png"))
    compose(512, scale=MASKABLE).save(os.path.join(ICONS, "icon-512-maskable.png"))
    compose(180).save(os.path.join(ICONS, "apple-touch-icon.png"))
    compose(64).save(os.path.join(WEBAPP, "favicon.ico"),
                     sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("Icones regenerees dans", ICONS, "+ favicon.ico")
    write_android_icons()


if __name__ == "__main__":
    main()
