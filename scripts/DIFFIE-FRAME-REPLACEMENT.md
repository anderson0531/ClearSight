# Diffie-Hellman animatic frame replacement

Replace an illustration for **Diffie-Hellman: The Visual Key Exchange** (`storyId: cmqurjoyl00079wn8smrqd28d`).

## Quick command (recommended)

From a Gemini blob URL — download, remove watermark, upload, update DB:

```bash
node scripts/replace-diffie-frame-from-url.mjs <frameIndex> '<image-url>'
```

Example (frame 15):

```bash
node scripts/replace-diffie-frame-from-url.mjs 15 \
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_wq39yowq39yowq39.png'
```

## Step-by-step (same route)

1. **Download** to `output/diffie-frame{N}-source.png`
2. **Remove watermark** → `output/diffie-frame{N}-clean.png`

   ```bash
   python3 scripts/remove-gemini-watermark.py output/diffie-frame{N}-source.png output/diffie-frame{N}-clean.png
   ```

3. **Upload + DB patch** (`sourcesVerified.audioSegments[N].imageUrl`)

   ```bash
   node scripts/replace-diffie-frame.mjs <frameIndex> output/diffie-frame{N}-clean.png
   ```

## Watermark removal (what works)

Gemini places a small sparkle on **dark desk/surface** near the bottom-right — usually **not** in the extreme pixel corner.

Two-pass inpaint (median fill from a ring outside each patch):

| Pass | Region | Frame 15 @ 2816×1536 |
|------|--------|----------------------|
| Desk sparkle zone | ~91–94% width, ~83–88% height | `(2560,1280)`–`(2648,1348)` |
| Corner fallback | Bottom-right 52×52 px | `(w-52,h-52)`–`(w,h)` |

Proportions are scaled automatically for other resolutions in `remove-gemini-watermark.py`.

**Do not** use bright-pixel outlier detection across the whole bottom-right quarter — it catches holographic UI glow and damages the frame.

## Prerequisites

- `.env` with database URL and `BLOB_READ_WRITE_TOKEN`
- `python3` with `pillow` and `numpy`: `pip install pillow numpy`

## Outputs

| File | Purpose |
|------|---------|
| `output/diffie-frame{N}-source.png` | Downloaded Gemini original |
| `output/diffie-frame{N}-clean.png` | Watermark removed, ready to upload |

## Scripts

| Script | Role |
|--------|------|
| `replace-diffie-frame-from-url.mjs` | End-to-end orchestrator |
| `remove-gemini-watermark.py` | Watermark removal |
| `replace-diffie-frame.mjs` | Blob upload + Prisma update |
| `replace-diffie-frame1.mjs` | Legacy one-off for frame 1 only |
