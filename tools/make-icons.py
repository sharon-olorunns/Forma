#!/usr/bin/env python3
"""Generate Forma's PNG icons.

Pure stdlib (zlib + struct) so there is no build dependency to install.
Run: python3 tools/make-icons.py
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")

BG = (14, 14, 13)
ACCENT = (224, 164, 88)
PROTEIN = (116, 198, 157)


def blend(bottom, top, alpha):
    return tuple(round(b + (t - b) * alpha) for b, t in zip(bottom, top))


def draw(size, safe=1.0):
    """Concentric macro rings on a dark ground. `safe` shrinks art for maskable icons."""
    px = [[BG for _ in range(size)] for _ in range(size)]
    cx = cy = (size - 1) / 2
    ss = 3  # supersample factor for smooth edges

    # radius (fraction of size), thickness, colour, sweep fraction, start angle
    rings = [
        (0.360 * safe, 0.070 * safe, ACCENT, 0.78, -0.5 * math.pi),
        (0.245 * safe, 0.058 * safe, PROTEIN, 0.55, -0.5 * math.pi),
    ]

    for y in range(size):
        for x in range(size):
            for radius, thickness, colour, sweep, start in rings:
                r_px = radius * size
                t_px = thickness * size
                hits = 0
                for sy in range(ss):
                    for sx in range(ss):
                        fx = x + (sx + 0.5) / ss - cx
                        fy = y + (sy + 0.5) / ss - cy
                        dist = math.hypot(fx, fy)
                        if abs(dist - r_px) > t_px / 2:
                            continue
                        angle = (math.atan2(fy, fx) - start) % (2 * math.pi)
                        if angle <= sweep * 2 * math.pi:
                            hits += 1
                if hits:
                    px[y][x] = blend(px[y][x], colour, hits / (ss * ss))

    # Centre dot — the "one plate" mark.
    dot_r = 0.075 * size * safe
    for y in range(size):
        for x in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    fx = x + (sx + 0.5) / ss - cx
                    fy = y + (sy + 0.5) / ss - cy
                    if math.hypot(fx, fy) <= dot_r:
                        hits += 1
            if hits:
                px[y][x] = blend(px[y][x], ACCENT, hits / (ss * ss))
    return px


def write_png(path, pixels):
    size = len(pixels)
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("3B", *pixels[y][x]) for x in range(size))
        for y in range(size)
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    print(f"wrote {os.path.relpath(path)} ({size}×{size}, {len(png):,} bytes)")


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0e0e0d"/>
  <circle cx="50" cy="50" r="36" fill="none" stroke="#e0a458" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="176.4 49.6" transform="rotate(-90 50 50)"/>
  <circle cx="50" cy="50" r="24.5" fill="none" stroke="#74c69d" stroke-width="5.8"
          stroke-linecap="round" stroke-dasharray="84.6 69.3" transform="rotate(-90 50 50)"/>
  <circle cx="50" cy="50" r="7.5" fill="#e0a458"/>
</svg>
"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    write_png(os.path.join(OUT_DIR, "icon-192.png"), draw(192))
    write_png(os.path.join(OUT_DIR, "icon-512.png"), draw(512))
    # Maskable icons get cropped to a circle-ish safe zone, so shrink the art.
    write_png(os.path.join(OUT_DIR, "icon-maskable-512.png"), draw(512, safe=0.72))
    write_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), draw(180))
    with open(os.path.join(OUT_DIR, "favicon.svg"), "w") as fh:
        fh.write(SVG)
    print("wrote assets/icons/favicon.svg")


if __name__ == "__main__":
    main()
