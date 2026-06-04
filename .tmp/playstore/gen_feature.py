from PIL import Image, ImageDraw, ImageFont

W, H = 1024, 500
CORAL = (255, 107, 76)        # Turnly coral
CORAL_DARK = (228, 79, 49)
INK = (24, 28, 36)
WHITE = (255, 255, 255)

img = Image.new("RGB", (W, H), CORAL)
draw = ImageDraw.Draw(img)

# Soft gradient using two diagonal triangles
for y in range(H):
    t = y / H
    r = int(CORAL[0] * (1 - t) + CORAL_DARK[0] * t)
    g = int(CORAL[1] * (1 - t) + CORAL_DARK[1] * t)
    b = int(CORAL[2] * (1 - t) + CORAL_DARK[2] * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Subtle circle accents (sun rays vibe)
for i, (cx, cy, rad, alpha) in enumerate([
    (900, 100, 280, 25),
    (820, 60, 180, 35),
    (980, 180, 120, 50),
]):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], fill=(255, 255, 255, alpha))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

# Paste app icon
try:
    icon = Image.open("/Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2/assets/icon/turnly-customer-1024.png").convert("RGBA")
    icon = icon.resize((200, 200), Image.LANCZOS)
    img.paste(icon, (70, 150), icon)
except Exception as e:
    print("icon paste err", e)

# Text
font_paths = [
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]
big = mid = None
for fp in font_paths:
    try:
        big = ImageFont.truetype(fp, 78)
        mid = ImageFont.truetype(fp, 32)
        break
    except Exception:
        continue
if big is None:
    big = ImageFont.load_default()
    mid = ImageFont.load_default()

draw.text((300, 175), "Turnly", fill=WHITE, font=big)
draw.text((302, 268), "Reserva tu turno sin esperar", fill=WHITE, font=mid)
draw.text((302, 315), "Barberías • Salones • Servicios", fill=(255, 230, 220), font=mid)

img.save("/Users/korbold/Documents/Freelancer/Turnly/.tmp/playstore/feature-1024x500.png", "PNG", optimize=True)
print("done")
