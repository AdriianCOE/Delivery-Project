from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "public" / "icons" / "android-chrome-512x512.png"
OUT_DIR = ROOT / "public" / "brand" / "banners"

ORANGE = "#F97316"
ORANGE_DARK = "#EA580C"
CREAM = "#FFF7ED"
CREAM_PREMIUM = "#FFFBF5"
TEXT = "#111827"
GRAY = "#4B5563"
LIGHT = "#F3F4F6"
WHITE = "#FFFFFF"

TAGLINE = "Seu delivery online, sem comissão por pedido."
SUPPORT_TEXT = "Cardápio digital, link próprio, pedidos e painel para vender com mais controle."
PROMISE = "Seu cardápio. Seu link. Seus pedidos. Zero comissão."
HANDLE = "pratoby.com  ·  @pratobybr"


@dataclass(frozen=True)
class BannerSpec:
    slug: str
    label: str
    width: int
    height: int
    layout: str


SPECS = [
    BannerSpec("principal-1600x900", "Peça principal / universal 16:9", 1600, 900, "wide"),
    BannerSpec("apresentacao-1920x1080", "Apresentação widescreen", 1920, 1080, "wide"),
    BannerSpec("open-graph-1200x630", "Open Graph / compartilhamento", 1200, 630, "wide"),
    BannerSpec("linkedin-cover-1584x396", "LinkedIn cover", 1584, 396, "panorama"),
    BannerSpec("facebook-cover-1640x624", "Facebook cover", 1640, 624, "panorama"),
    BannerSpec("instagram-feed-1080x1080", "Instagram feed quadrado", 1080, 1080, "square"),
    BannerSpec("story-1080x1920", "Stories/Reels vertical", 1080, 1920, "vertical"),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rgba(value: str, alpha: int) -> tuple[int, int, int, int]:
    return (*hex_to_rgb(value), alpha)


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient_background(width: int, height: int) -> Image.Image:
    start = hex_to_rgb(CREAM_PREMIUM)
    end = hex_to_rgb(CREAM)
    image = Image.new("RGBA", (width, height), start + (255,))
    pixels = image.load()

    for y in range(height):
        for x in range(width):
            diagonal = (x / max(width - 1, 1)) * 0.55 + (y / max(height - 1, 1)) * 0.45
            warm = (
                lerp(start[0], end[0], diagonal),
                lerp(start[1], end[1], diagonal),
                lerp(start[2], end[2], diagonal),
                255,
            )
            pixels[x, y] = warm

    return image


def add_radial_glow(base: Image.Image, center: tuple[float, float], radius: float, color: str, alpha: int) -> None:
    width, height = base.size
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    px = glow.load()
    rgb = hex_to_rgb(color)
    cx, cy = center

    min_x = max(0, int(cx - radius))
    max_x = min(width, int(cx + radius))
    min_y = max(0, int(cy - radius))
    max_y = min(height, int(cy + radius))

    for y in range(min_y, max_y):
        for x in range(min_x, max_x):
            distance = math.hypot(x - cx, y - cy) / radius
            if distance <= 1:
                strength = (1 - distance) ** 2
                px[x, y] = (*rgb, round(alpha * strength))

    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(8, int(radius * 0.04))))
    base.alpha_composite(glow)


def font_path(*names: str) -> str | None:
    candidates = [
        Path("C:/Windows/Fonts") / name
        for name in names
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


FONT_BLACK = font_path("segoeuib.ttf", "arialbd.ttf")
FONT_BOLD = font_path("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf")
FONT_REGULAR = font_path("segoeui.ttf", "arial.ttf")


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    selected = {
        "black": FONT_BLACK,
        "bold": FONT_BOLD,
        "regular": FONT_REGULAR,
    }.get(weight, FONT_REGULAR)
    if selected:
        return ImageFont.truetype(selected, size=size)
    return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, text_font: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=text_font)
    return box[2] - box[0], box[3] - box[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, text_font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if text_size(draw, candidate, text_font)[0] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)
    return lines


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    text_font: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    line_gap: int,
) -> int:
    x, y = xy
    lines = wrap_text(draw, text, text_font, max_width)
    for line in lines:
        draw.text((x, y), line, font=text_font, fill=fill)
        _, line_height = text_size(draw, line, text_font)
        y += line_height + line_gap
    return y


def alpha_round_rect(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    width: int = 1,
) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    base.alpha_composite(overlay)


def draw_shadowed_rect(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    shadow_alpha: int = 26,
    shadow_offset: tuple[int, int] = (0, 18),
    blur: int = 28,
) -> None:
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sx, sy = shadow_offset
    shifted = (box[0] + sx, box[1] + sy, box[2] + sx, box[3] + sy)
    sd.rounded_rectangle(shifted, radius=radius, fill=(17, 24, 39, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)
    alpha_round_rect(base, box, radius, fill, rgba(ORANGE, 34), max(1, round((box[2] - box[0]) * 0.002)))


def paste_logo(base: Image.Image, x: int, y: int, size: int) -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    base.alpha_composite(logo, (x, y))


def draw_brand_lockup(draw: ImageDraw.ImageDraw, base: Image.Image, x: int, y: int, scale: float) -> int:
    mark = int(82 * scale)
    paste_logo(base, x, y - int(10 * scale), mark)
    word_font = font(int(58 * scale), "black")
    sub_font = font(int(19 * scale), "regular")
    word_x = x + mark + int(18 * scale)
    draw.text((word_x, y), "PratoBy", font=word_font, fill=TEXT)
    draw.text((word_x + int(4 * scale), y + int(62 * scale)), "Cardápio digital e delivery próprio", font=sub_font, fill=GRAY)
    return y + int(96 * scale)


def draw_pill(draw: ImageDraw.ImageDraw, base: Image.Image, x: int, y: int, text: str, scale: float) -> int:
    text_font = font(int(19 * scale), "bold")
    txw, txh = text_size(draw, text, text_font)
    pad_x = int(22 * scale)
    pad_y = int(12 * scale)
    box = (x, y, x + txw + pad_x * 2, y + txh + pad_y * 2)
    alpha_round_rect(base, box, int(22 * scale), (255, 255, 255, 190), rgba(ORANGE, 38), max(1, int(1.4 * scale)))
    draw.text((x + pad_x, y + pad_y - int(1 * scale)), text, font=text_font, fill=TEXT)
    return box[2]


def draw_feature_pills(draw: ImageDraw.ImageDraw, base: Image.Image, x: int, y: int, max_width: int, scale: float) -> int:
    labels = ["Link próprio", "Pedidos online", "Zero comissão"]
    cursor_x = x
    cursor_y = y
    gap = int(12 * scale)
    for label in labels:
        text_font = font(int(18 * scale), "bold")
        label_w = text_size(draw, label, text_font)[0] + int(56 * scale)
        if cursor_x + label_w > x + max_width:
            cursor_x = x
            cursor_y += int(54 * scale)
        end_x = draw_pill(draw, base, cursor_x, cursor_y, label, scale)
        cursor_x = end_x + gap
    return cursor_y + int(52 * scale)


def draw_saas_mock(base: Image.Image, x: int, y: int, w: int, h: int, scale: float) -> None:
    draw = ImageDraw.Draw(base)
    draw_shadowed_rect(base, (x, y, x + w, y + h), int(42 * scale), (255, 255, 255, 218), 32, (0, int(24 * scale)), int(34 * scale))

    pad = int(34 * scale)
    header_h = int(82 * scale)
    alpha_round_rect(base, (x + pad, y + pad, x + w - pad, y + pad + header_h), int(28 * scale), rgba(CREAM, 245), rgba(ORANGE, 40), max(1, int(1.4 * scale)))
    draw.text((x + pad + int(22 * scale), y + pad + int(18 * scale)), "Painel do lojista", font=font(int(24 * scale), "black"), fill=TEXT)
    draw.text((x + pad + int(22 * scale), y + pad + int(49 * scale)), "Pedidos em tempo real", font=font(int(17 * scale), "regular"), fill=GRAY)

    badge_w = int(130 * scale)
    alpha_round_rect(
        base,
        (x + w - pad - badge_w, y + pad + int(18 * scale), x + w - pad - int(18 * scale), y + pad + int(56 * scale)),
        int(20 * scale),
        rgba(ORANGE, 255),
    )
    draw.text((x + w - pad - badge_w + int(18 * scale), y + pad + int(25 * scale)), "ABERTO", font=font(int(15 * scale), "black"), fill=WHITE)

    card_y = y + pad + header_h + int(24 * scale)
    card_gap = int(18 * scale)
    footer_y = y + h - pad - int(66 * scale)
    items = [
        ("Pedido #1042", "Bolo Red Velvet", "R$ 89,90"),
        ("Pedido #1043", "Burger artesanal", "R$ 34,90"),
        ("Pedido #1044", "Combo família", "R$ 72,50"),
    ]

    available_cards_h = max(int(96 * scale), footer_y - card_y - int(20 * scale))
    min_card_h = int(64 * scale)
    visible_count = min(len(items), max(1, int((available_cards_h + card_gap) / (min_card_h + card_gap))))
    card_h = int((available_cards_h - card_gap * (visible_count - 1)) / visible_count)

    for i, (title, desc, price) in enumerate(items[:visible_count]):
        cy = card_y + i * (card_h + card_gap)
        alpha_round_rect(base, (x + pad, cy, x + w - pad, cy + card_h), int(24 * scale), (255, 255, 255, 235), rgba(LIGHT, 255), max(1, int(1.3 * scale)))
        dot = (x + pad + int(20 * scale), cy + int(21 * scale), x + pad + int(58 * scale), cy + int(59 * scale))
        alpha_round_rect(base, dot, int(16 * scale), rgba(ORANGE, 255))
        draw.text((x + pad + int(76 * scale), cy + int(14 * scale)), title, font=font(int(18 * scale), "black"), fill=TEXT)
        draw.text((x + pad + int(76 * scale), cy + int(42 * scale)), desc, font=font(int(15 * scale), "regular"), fill=GRAY)
        draw.text((x + w - pad - int(130 * scale), cy + int(28 * scale)), price, font=font(int(17 * scale), "black"), fill=ORANGE_DARK)

    alpha_round_rect(base, (x + pad, footer_y, x + w - pad, footer_y + int(66 * scale)), int(26 * scale), rgba(TEXT, 245))
    draw.text((x + pad + int(24 * scale), footer_y + int(20 * scale)), "Mais controle.", font=font(int(19 * scale), "black"), fill=WHITE)
    draw.text((x + w - pad - int(114 * scale), footer_y + int(20 * scale)), "PratoBy", font=font(int(18 * scale), "bold"), fill=ORANGE)


def draw_phone_mock(base: Image.Image, x: int, y: int, w: int, h: int, scale: float) -> None:
    draw = ImageDraw.Draw(base)
    draw_shadowed_rect(base, (x, y, x + w, y + h), int(58 * scale), rgba(TEXT, 255), 36, (0, int(24 * scale)), int(36 * scale))
    inner = (x + int(14 * scale), y + int(14 * scale), x + w - int(14 * scale), y + h - int(14 * scale))
    alpha_round_rect(base, inner, int(46 * scale), (255, 255, 255, 255))

    notch_w = int(w * 0.28)
    notch_h = int(18 * scale)
    alpha_round_rect(base, (x + (w - notch_w) // 2, y + int(25 * scale), x + (w + notch_w) // 2, y + int(25 * scale) + notch_h), int(12 * scale), rgba(TEXT, 255))

    ix, iy, ir, ib = inner
    paste_logo(base, ix + int(22 * scale), iy + int(38 * scale), int(42 * scale))
    draw.text((ix + int(72 * scale), iy + int(46 * scale)), "PratoBy", font=font(int(22 * scale), "black"), fill=TEXT)

    hero_y = iy + int(102 * scale)
    alpha_round_rect(base, (ix + int(24 * scale), hero_y, ir - int(24 * scale), hero_y + int(112 * scale)), int(28 * scale), rgba(CREAM, 255), rgba(ORANGE, 42), max(1, int(1.1 * scale)))
    draw.text((ix + int(42 * scale), hero_y + int(22 * scale)), "Sua loja online", font=font(int(22 * scale), "black"), fill=TEXT)
    draw.text((ix + int(42 * scale), hero_y + int(56 * scale)), "Pedidos sem comissão", font=font(int(17 * scale), "regular"), fill=GRAY)
    alpha_round_rect(base, (ix + int(42 * scale), hero_y + int(82 * scale), ix + int(154 * scale), hero_y + int(112 * scale)), int(15 * scale), rgba(ORANGE, 255))
    draw.text((ix + int(58 * scale), hero_y + int(88 * scale)), "Pedir", font=font(int(13 * scale), "black"), fill=WHITE)

    list_y = hero_y + int(140 * scale)
    for i, name in enumerate(["Destaques", "Pronta entrega", "Bebidas"]):
        cy = list_y + i * int(72 * scale)
        alpha_round_rect(base, (ix + int(24 * scale), cy, ir - int(24 * scale), cy + int(58 * scale)), int(18 * scale), (255, 255, 255, 255), rgba(LIGHT, 255), max(1, int(1 * scale)))
        alpha_round_rect(base, (ix + int(38 * scale), cy + int(12 * scale), ix + int(72 * scale), cy + int(46 * scale)), int(13 * scale), rgba(ORANGE, 230))
        draw.text((ix + int(86 * scale), cy + int(17 * scale)), name, font=font(int(16 * scale), "bold"), fill=TEXT)
        draw.text((ir - int(94 * scale), cy + int(17 * scale)), "+", font=font(int(22 * scale), "black"), fill=ORANGE)


def draw_brand_art(spec: BannerSpec) -> Image.Image:
    w, h = spec.width, spec.height
    base = gradient_background(w, h)
    draw = ImageDraw.Draw(base)

    add_radial_glow(base, (w * 0.84, h * 0.18), max(w, h) * 0.38, ORANGE, 80)
    add_radial_glow(base, (w * 0.1, h * 0.92), max(w, h) * 0.32, ORANGE, 44)
    add_radial_glow(base, (w * 0.72, h * 0.95), max(w, h) * 0.26, ORANGE_DARK, 46)

    line = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    for i in range(5):
        offset = i * h * 0.06
        ld.arc(
            (int(-w * 0.18), int(h * 0.48 + offset), int(w * 0.48), int(h * 1.36 + offset)),
            195,
            337,
            fill=rgba(ORANGE, 28 - i * 3),
            width=max(1, int(min(w, h) * 0.002)),
        )
    base.alpha_composite(line)

    if spec.layout == "vertical":
        scale = w / 1200
        left_x = int(w * 0.09)
        top_y = int(h * 0.075)
        draw_brand_lockup(draw, base, left_x, top_y, scale * 1.1)
        headline_font = font(int(70 * scale), "black")
        y = int(h * 0.22)
        y = draw_text_block(draw, (left_x, y), PROMISE, headline_font, TEXT, int(w * 0.78), int(13 * scale))
        y += int(22 * scale)
        y = draw_text_block(draw, (left_x, y), SUPPORT_TEXT, font(int(31 * scale), "regular"), GRAY, int(w * 0.78), int(10 * scale))
        draw_feature_pills(draw, base, left_x, y + int(26 * scale), int(w * 0.82), scale)
        draw_phone_mock(base, int(w * 0.23), int(h * 0.56), int(w * 0.54), int(h * 0.34), scale * 1.08)
        draw.text((left_x, int(h * 0.935)), HANDLE, font=font(int(25 * scale), "bold"), fill=GRAY)
        return base

    if spec.layout == "square":
        scale = w / 1200
        left_x = int(w * 0.08)
        draw_brand_lockup(draw, base, left_x, int(h * 0.08), scale)
        headline_font = font(int(58 * scale), "black")
        y = int(h * 0.25)
        y = draw_text_block(draw, (left_x, y), PROMISE, headline_font, TEXT, int(w * 0.84), int(12 * scale))
        y += int(18 * scale)
        draw_text_block(draw, (left_x, y), TAGLINE, font(int(30 * scale), "bold"), ORANGE_DARK, int(w * 0.8), int(8 * scale))
        draw_saas_mock(base, int(w * 0.12), int(h * 0.54), int(w * 0.76), int(h * 0.34), scale * 0.9)
        draw.text((left_x, int(h * 0.91)), HANDLE, font=font(int(24 * scale), "bold"), fill=GRAY)
        return base

    if spec.layout == "panorama":
        scale = h / 640
        left_x = int(w * 0.075)
        center_y = int(h * 0.5)
        draw_brand_lockup(draw, base, left_x, int(h * 0.16), scale * 0.92)
        headline_font = font(int(48 * scale), "black")
        y = int(h * 0.42)
        y = draw_text_block(draw, (left_x, y), TAGLINE, headline_font, TEXT, int(w * 0.48), int(8 * scale))
        draw.text((left_x, y + int(8 * scale)), HANDLE, font=font(int(20 * scale), "bold"), fill=GRAY)
        draw_saas_mock(base, int(w * 0.57), int(h * 0.12), int(w * 0.34), int(h * 0.74), scale * 0.72)
        draw_pill(draw, base, int(w * 0.42), center_y + int(h * 0.18), "Zero comissão", scale * 0.9)
        return base

    scale = w / 1600
    left_x = int(w * 0.085)
    draw_brand_lockup(draw, base, left_x, int(h * 0.13), scale)
    headline_font = font(int(66 * scale), "black")
    y = int(h * 0.34)
    y = draw_text_block(draw, (left_x, y), PROMISE, headline_font, TEXT, int(w * 0.46), int(13 * scale))
    y += int(18 * scale)
    y = draw_text_block(draw, (left_x, y), SUPPORT_TEXT, font(int(28 * scale), "regular"), GRAY, int(w * 0.48), int(8 * scale))
    draw_feature_pills(draw, base, left_x, y + int(30 * scale), int(w * 0.5), scale * 0.92)
    draw.text((left_x, int(h * 0.86)), HANDLE, font=font(int(24 * scale), "bold"), fill=GRAY)
    draw_saas_mock(base, int(w * 0.57), int(h * 0.18), int(w * 0.34), int(h * 0.58), scale)
    draw_phone_mock(base, int(w * 0.73), int(h * 0.21), int(w * 0.15), int(h * 0.52), scale * 0.82)
    return base


def svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def svg_text_lines(text: str, x: int, y: int, size: int, width: int, weight: int, color: str, line_height: float = 1.15) -> str:
    avg_char = size * 0.52
    max_chars = max(10, int(width / avg_char))
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    tspans = []
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else size * line_height
        tspans.append(f'<tspan x="{x}" dy="{dy:.1f}">{svg_escape(line)}</tspan>')
    return f'<text x="{x}" y="{y}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}">{"".join(tspans)}</text>'


def build_svg(spec: BannerSpec) -> str:
    w, h = spec.width, spec.height
    logo_href = "../../icons/android-chrome-512x512.png"
    if spec.layout == "vertical":
        title_size, text_width = int(w * 0.067), int(w * 0.8)
        logo = int(w * 0.12)
        x, y = int(w * 0.09), int(h * 0.08)
        art = f'<rect x="{int(w*.2)}" y="{int(h*.58)}" width="{int(w*.6)}" height="{int(h*.28)}" rx="{int(w*.055)}" fill="white" opacity=".82" stroke="#FED7AA"/>'
    elif spec.layout == "square":
        title_size, text_width = int(w * 0.055), int(w * 0.82)
        logo = int(w * 0.09)
        x, y = int(w * 0.08), int(h * 0.08)
        art = f'<rect x="{int(w*.12)}" y="{int(h*.58)}" width="{int(w*.76)}" height="{int(h*.27)}" rx="{int(w*.045)}" fill="white" opacity=".82" stroke="#FED7AA"/>'
    elif spec.layout == "panorama":
        title_size, text_width = int(h * 0.125), int(w * 0.45)
        logo = int(h * 0.18)
        x, y = int(w * 0.075), int(h * 0.16)
        art = f'<rect x="{int(w*.58)}" y="{int(h*.14)}" width="{int(w*.32)}" height="{int(h*.70)}" rx="{int(h*.08)}" fill="white" opacity=".82" stroke="#FED7AA"/>'
    else:
        title_size, text_width = int(w * 0.041), int(w * 0.48)
        logo = int(w * 0.055)
        x, y = int(w * 0.085), int(h * 0.13)
        art = f'<rect x="{int(w*.57)}" y="{int(h*.18)}" width="{int(w*.34)}" height="{int(h*.58)}" rx="{int(w*.026)}" fill="white" opacity=".82" stroke="#FED7AA"/>'

    headline_y = y + int(logo * 1.75)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{CREAM_PREMIUM}"/>
      <stop offset="100%" stop-color="{CREAM}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="16%" r="55%">
      <stop offset="0%" stop-color="{ORANGE}" stop-opacity=".36"/>
      <stop offset="100%" stop-color="{ORANGE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <circle cx="{int(w*.84)}" cy="{int(h*.93)}" r="{int(min(w,h)*.34)}" fill="{ORANGE_DARK}" opacity=".10"/>
  <path d="M{-int(w*.1)} {int(h*.82)} C {int(w*.18)} {int(h*.58)}, {int(w*.28)} {int(h*1.05)}, {int(w*.58)} {int(h*.72)}" fill="none" stroke="{ORANGE}" stroke-opacity=".16" stroke-width="{max(2, int(min(w,h)*.003))}"/>
  <image href="{logo_href}" x="{x}" y="{y - int(logo*.12)}" width="{logo}" height="{logo}" preserveAspectRatio="xMidYMid meet"/>
  <text x="{x + int(logo*1.24)}" y="{y + int(logo*.48)}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{int(logo*.62)}" font-weight="800" fill="{TEXT}">PratoBy</text>
  <text x="{x + int(logo*1.27)}" y="{y + int(logo*.82)}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{int(logo*.22)}" font-weight="500" fill="{GRAY}">Cardápio digital e delivery próprio</text>
  {svg_text_lines(PROMISE if spec.layout != "panorama" else TAGLINE, x, headline_y, title_size, text_width, 800, TEXT)}
  <text x="{x}" y="{int(h*.86 if spec.layout != "vertical" else h*.935)}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{max(18, int(min(w,h)*.027))}" font-weight="700" fill="{GRAY}">{svg_escape(HANDLE)}</text>
  {art}
  <rect x="{int(w*.61)}" y="{int(h*.28)}" width="{int(w*.18)}" height="{int(h*.06)}" rx="{int(h*.03)}" fill="{ORANGE}" opacity=".95"/>
  <text x="{int(w*.63)}" y="{int(h*.318)}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{max(14, int(min(w,h)*.027))}" font-weight="800" fill="white">Zero comissão</text>
</svg>
'''


def write_manifest(specs: Iterable[BannerSpec]) -> None:
    data = {
        "brand": "PratoBy",
        "sourceLogo": "public/icons/android-chrome-512x512.png",
        "palette": {
            "orange": ORANGE,
            "orangeDark": ORANGE_DARK,
            "cream": CREAM,
            "premiumCream": CREAM_PREMIUM,
            "text": TEXT,
            "gray": GRAY,
        },
        "positioning": TAGLINE,
        "files": [
            {
                "slug": spec.slug,
                "label": spec.label,
                "png": f"{spec.slug}.png",
                "svg": f"{spec.slug}.svg",
                "width": spec.width,
                "height": spec.height,
            }
            for spec in specs
        ],
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f"Logo não encontrada: {LOGO_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for spec in SPECS:
        image = draw_brand_art(spec)
        png_path = OUT_DIR / f"{spec.slug}.png"
        svg_path = OUT_DIR / f"{spec.slug}.svg"
        image.save(png_path, optimize=True)
        svg_path.write_text(build_svg(spec), encoding="utf-8")
        print(f"generated {png_path.relative_to(ROOT)}")
        print(f"generated {svg_path.relative_to(ROOT)}")

    write_manifest(SPECS)
    print(f"generated {(OUT_DIR / 'manifest.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
