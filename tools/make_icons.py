# アプリのアイコンを描く。4倍で描いてから縮小してなめらかにする。
# 使い方: python3 tools/make_icons.py icons  （Pillow が必要）
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
SS = 4  # スーパーサンプリング倍率
BASE = 1024

TOP = (99, 102, 241)      # #6366f1
BOTTOM = (67, 56, 202)    # #4338ca


def gradient(size):
    """左上が明るく右下が濃い斜めのグラデーション"""
    mask = Image.linear_gradient('L').resize((size * 2, size * 2)).rotate(45, resample=Image.BICUBIC)
    mask = mask.crop((size // 2, size // 2, size // 2 + size, size // 2 + size))
    return Image.composite(Image.new('RGB', (size, size), BOTTOM), Image.new('RGB', (size, size), TOP), mask)


def composition(scale):
    """カレンダー + コインの絵（透明背景）。scale はアイコン全体に対する大きさ"""
    S = BASE * SS
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # 絵全体（x 205〜903, y 200〜923）の真ん中がアイコンの真ん中に来るようにする
    def px(v):
        return (512 + (v - 554) * scale) * SS

    def py(v):
        return (512 + (v - 561.5) * scale) * SS

    def box(x0, y0, x1, y1):
        return (px(x0), py(y0), px(x1), py(y1))

    r = lambda v: v * scale * SS

    # 影
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(box(205, 275, 765, 825), radius=r(84), fill=(20, 16, 80, 110))
    sd.ellipse(box(745 - 158, 785 - 158, 745 + 158, 785 + 158), fill=(20, 16, 80, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(r(22)))
    layer.alpha_composite(shadow)

    d = ImageDraw.Draw(layer)
    # カレンダーの紙
    d.rounded_rectangle(box(205, 255, 765, 805), radius=r(84), fill=(255, 255, 255, 255))
    # 上の帯
    d.rounded_rectangle(box(205, 255, 765, 385 + 84), radius=r(84), fill=(224, 231, 255, 255))
    d.rectangle(box(205, 385, 765, 385 + 84), fill=(255, 255, 255, 255))
    # リング
    for x in (334, 584):
        d.rounded_rectangle(box(x, 200, x + 52, 320), radius=r(26), fill=(255, 255, 255, 255))
        d.rounded_rectangle(box(x + 12, 212, x + 40, 308), radius=r(14), fill=(165, 180, 252, 255))

    # シフトの色のマス 3×3
    colors = [
        (46, 157, 91), (232, 131, 58), (91, 91, 214),
        (47, 125, 225), (138, 143, 152), (142, 91, 214),
        (199, 154, 30), (46, 157, 91), (58, 166, 216),
    ]
    w, h, gx, gy = 124, 92, 22, 22
    x0, y0 = 485 - (3 * w + 2 * gx) / 2, 415
    for i, c in enumerate(colors):
        row, col = divmod(i, 3)
        x = x0 + col * (w + gx)
        y = y0 + row * (h + gy)
        d.rounded_rectangle(box(x, y, x + w, y + h), radius=r(22), fill=c + (255,))
    # 1つ目のマスにチェック
    cx, cy = x0, y0
    pts = [(cx + 32, cy + 48), (cx + 54, cy + 70), (cx + 94, cy + 26)]
    d.line([(px(a), py(b)) for a, b in pts], fill=(255, 255, 255, 255), width=int(r(16)), joint='curve')
    for a, b in (pts[0], pts[-1]):
        rr = r(8)
        d.ellipse((px(a) - rr, py(b) - rr, px(a) + rr, py(b) + rr), fill=(255, 255, 255, 255))

    # コイン（¥）
    ccx, ccy, R = 745, 765, 158
    d.ellipse(box(ccx - R, ccy - R, ccx + R, ccy + R), fill=(217, 154, 6, 255))
    d.ellipse(box(ccx - 128, ccy - 128, ccx + 128, ccy + 128), fill=(251, 191, 36, 255))
    ink = (122, 74, 0, 255)
    stroke = int(r(30))
    yen = [
        [(ccx - 60, ccy - 80), (ccx, ccy - 6), (ccx + 60, ccy - 80)],
        [(ccx, ccy - 6), (ccx, ccy + 88)],
        [(ccx - 54, ccy + 14), (ccx + 54, ccy + 14)],
        [(ccx - 54, ccy + 52), (ccx + 54, ccy + 52)],
    ]
    for line in yen:
        d.line([(px(a), py(b)) for a, b in line], fill=ink, width=stroke, joint='curve')
        for a, b in (line[0], line[-1]):
            rr = stroke / 2
            d.ellipse((px(a) - rr, py(b) - rr, px(a) + rr, py(b) + rr), fill=ink)
    return layer


def full_bleed(scale):
    S = BASE * SS
    img = gradient(S).convert('RGBA')
    img.alpha_composite(composition(scale))
    return img.convert('RGB')


def rounded(scale):
    S = BASE * SS
    bg = gradient(S).convert('RGBA')
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.2237), fill=255)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)
    img.alpha_composite(composition(scale))
    return img


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}', optimize=True)


apple = full_bleed(0.98)
save(apple, 180, 'apple-touch-icon.png')
anyicon = rounded(0.88)
save(anyicon, 512, 'icon-512.png')
save(anyicon, 192, 'icon-192.png')
save(anyicon, 32, 'favicon-32.png')
maskable = full_bleed(0.88)
save(maskable, 512, 'icon-maskable-512.png')
save(maskable, 192, 'icon-maskable-192.png')
print('ok')
