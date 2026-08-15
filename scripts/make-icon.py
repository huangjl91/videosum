from PIL import Image
import os

src = r"D:\Program Files\微信聊天记录\xwechat_files\wxid_bm6db38pvtx422_1b2c\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\34ff2c8b8a6cd39935275f92fb3202a0.jpg"
out_dir = r"E:\workbuddy开发\videosum\build"
os.makedirs(out_dir, exist_ok=True)

img = Image.open(src).convert("RGBA")
w, h = img.size

# Detect outer background color from the four corners (sample a small 8x8 area)
def sample_color(x, y, size=8):
    r = g = b = count = 0
    for dy in range(size):
        for dx in range(size):
            px, py = x + dx, y + dy
            if 0 <= px < w and 0 <= py < h:
                rr, gg, bb, _ = img.getpixel((px, py))
                r += rr; g += gg; b += bb; count += 1
    return (r // count, g // count, b // count)

corners = [
    sample_color(0, 0),
    sample_color(w - 8, 0),
    sample_color(0, h - 8),
    sample_color(w - 8, h - 8),
]
# Use the brightest corner as the white background reference
bg = max(corners, key=lambda c: sum(c))
print("Detected background color:", bg)

# Build alpha mask: pixels close to background become transparent.
# We use a threshold and smooth transition for anti-aliased edges.
data = img.load()
threshold = 42
feather = 35
for y in range(h):
    for x in range(w):
        r, g, b, a = data[x, y]
        dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        if dist < threshold:
            alpha = 0
        elif dist < threshold + feather:
            alpha = int(255 * (dist - threshold) / feather)
        else:
            alpha = 255
        # Preserve existing alpha
        data[x, y] = (r, g, b, min(a, alpha))

# Trim transparent edges
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Resize to a nice square icon size if needed, keeping aspect ratio
size = 1024
img.thumbnail((size, size), Image.LANCZOS)
# Center on transparent square canvas
square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
x = (size - img.width) // 2
y = (size - img.height) // 2
square.paste(img, (x, y), img)

png_path = os.path.join(out_dir, "icon.png")
square.save(png_path)
print("Saved PNG:", png_path)

# Generate Windows ICO
ico_path = os.path.join(out_dir, "icon.ico")
square.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("Saved ICO:", ico_path)
