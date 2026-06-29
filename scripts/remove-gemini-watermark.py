#!/usr/bin/env python3
"""
Remove the Gemini sparkle watermark from Diffie-Hellman animatic frame images.

Successful route (frame 15, 2816x1536):
  1. Inpaint the desk-zone rectangle where Gemini places the sparkle on dark surfaces
     (~91–94% width, ~83–88% height — right of the holographic base, not the image corner).
  2. Inpaint the extreme bottom-right 52x52 px corner (subtle sparkle fallback).

Uses median color sampled from a ring just outside each rectangle so fills match local background.

Usage:
  python3 scripts/remove-gemini-watermark.py <source.png> [output.png]

Requires: pip install pillow numpy
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Desk sparkle zone (proportional to frame 15 success at 2816x1536 → 2560–2648, 1280–1348)
DESK_X1_FRAC = 2560 / 2816
DESK_X2_FRAC = 2648 / 2816
DESK_Y1_FRAC = 1280 / 1536
DESK_Y2_FRAC = 1348 / 1536
DESK_BORDER = 12

# Extreme bottom-right corner patch
CORNER_SIZE = 52
CORNER_BORDER = 14


def inpaint_rect(
    arr: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    border: int,
) -> tuple[np.ndarray, list[int]]:
    """Fill a rectangle with the median color from a ring just outside it."""
    h, w = arr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return arr, [0, 0, 0]

    filled = arr.copy()
    ya, yb = max(0, y1 - border), min(h, y2 + border)
    xa, xb = max(0, x1 - border), min(w, x2 + border)
    ring = arr[ya:yb, xa:xb].copy()
    mask = np.zeros((yb - ya, xb - xa), dtype=bool)
    ly1, ly2 = y1 - ya, y2 - ya
    lx1, lx2 = x1 - xa, x2 - xa
    mask[ly1:ly2, lx1:lx2] = True
    valid = ring[~mask]

    if len(valid) == 0:
        above = arr[max(0, y1 - 40) : y1, x1:x2].reshape(-1, 3)
        fill = np.median(above, axis=0) if len(above) else np.median(arr.reshape(-1, 3), axis=0)
    else:
        fill = np.median(valid, axis=0)

    filled[y1:y2, x1:x2] = fill
    return filled, fill.astype(int).tolist()


def remove_gemini_watermark(arr: np.ndarray) -> tuple[np.ndarray, dict]:
    """Apply the two-pass watermark removal used for Diffie-Hellman frame replacements."""
    h, w = arr.shape[:2]
    meta: dict = {'width': w, 'height': h, 'passes': []}

    desk_x1 = int(w * DESK_X1_FRAC)
    desk_x2 = int(w * DESK_X2_FRAC)
    desk_y1 = int(h * DESK_Y1_FRAC)
    desk_y2 = int(h * DESK_Y2_FRAC)
    arr, desk_fill = inpaint_rect(arr, desk_x1, desk_y1, desk_x2, desk_y2, DESK_BORDER)
    meta['passes'].append(
        {
            'name': 'desk-sparkle-zone',
            'rect': [desk_x1, desk_y1, desk_x2, desk_y2],
            'fill_rgb': desk_fill,
        }
    )

    arr, corner_fill = inpaint_rect(
        arr, w - CORNER_SIZE, h - CORNER_SIZE, w, h, CORNER_BORDER
    )
    meta['passes'].append(
        {
            'name': 'bottom-right-corner',
            'rect': [w - CORNER_SIZE, h - CORNER_SIZE, w, h],
            'fill_rgb': corner_fill,
        }
    )

    return arr, meta


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 1

    source = Path(sys.argv[1])
    if not source.is_file():
        print(f'Source not found: {source}', file=sys.stderr)
        return 1

    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else source.with_name(source.stem + '-clean.png')

    img = Image.open(source).convert('RGB')
    cleaned, meta = remove_gemini_watermark(np.array(img, dtype=np.float32))
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cleaned.astype(np.uint8)).save(dest)

    print(f'Source: {source} ({meta["width"]}x{meta["height"]})')
    for p in meta['passes']:
        r = p['rect']
        print(f'  {p["name"]}: ({r[0]},{r[1]})-({r[2]},{r[3]}) fill={p["fill_rgb"]}')
    print(f'Output: {dest}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
