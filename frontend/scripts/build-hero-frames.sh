#!/usr/bin/env bash
# Turn a hero video clip into the scroll-scrubbed frame sequences used by
# src/components/home/HeroPour.tsx.
#
# Usage (from anywhere, Git Bash / macOS / Linux; needs ffmpeg with libwebp):
#   frontend/scripts/build-hero-frames.sh <clip.mp4> [options]
#
# Options:
#   --height <px>     Output height: 720, 1080 (default) or 1440. Desktop frames are
#                     16:9 at this height; mobile frames are a 3:4 crop of it.
#   --no-treat        Skip the edge treatment (use when the clip is already clean).
#   --crop-x <px>     Left edge of the 3:4 mobile crop, measured at 720p scale
#                     (0-740, default 440 — centred on the glass in the original
#                     pour); scaled automatically for --height. Re-tune for a clip
#                     framed differently.
#   --fps <n>         Frames per second to sample (default 8).
#   --quality <n>     WebP quality 0-100 (default 68).
#
# Output: frontend/public/hero/{desktop,mobile}/frame-NNN.webp + poster.webp.
# Afterwards, set HERO_FRAME_COUNT in src/utils/frameSequence.ts to the frame
# count this script prints, and check sizes (at 1080p expect roughly desktop ≲ 3 MB,
# mobile ≲ 2 MB).

set -euo pipefail

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

[ $# -ge 1 ] || usage
CLIP="$1"; shift
TREAT=1
HEIGHT=1080
CROP_X=440
FPS=8
QUALITY=68

while [ $# -gt 0 ]; do
  case "$1" in
    --height) HEIGHT="$2"; shift ;;
    --no-treat) TREAT=0 ;;
    --crop-x) CROP_X="$2"; shift ;;
    --fps) FPS="$2"; shift ;;
    --quality) QUALITY="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
  shift
done

is_uint() { [[ "$1" =~ ^[0-9]+$ ]]; }

# --crop-x must land the 540px-wide mobile crop inside the normalised
# 1280px-wide frame (1280 - 540 = 740), or ffmpeg fails with an opaque crop
# error deep inside export_set.
is_uint "$CROP_X" && [ "$CROP_X" -le 740 ] || { echo "--crop-x must be an integer between 0 and 740 (got: $CROP_X)" >&2; exit 1; }
case "$HEIGHT" in 720|1080|1440) ;; *) echo "--height must be 720, 1080 or 1440 (got: $HEIGHT)" >&2; exit 1 ;; esac
is_uint "$FPS" && [ "$FPS" -ge 1 ] || { echo "--fps must be a positive integer (got: $FPS)" >&2; exit 1; }
is_uint "$QUALITY" && [ "$QUALITY" -ge 1 ] && [ "$QUALITY" -le 100 ] || { echo "--quality must be a positive integer no greater than 100 (got: $QUALITY)" >&2; exit 1; }

[ -f "$CLIP" ] || { echo "Clip not found: $CLIP" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is not on PATH" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../public/hero"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

WIDTH=$((HEIGHT * 16 / 9))
MOBILE_WIDTH=$((HEIGHT * 3 / 4))
MOBILE_X=$((CROP_X * HEIGHT / 720))

# 1. Normalise to WIDTHxHEIGHT so the mask and crop coordinates below always apply.
ffmpeg -loglevel error -y -i "$CLIP" -an -vf "scale=$WIDTH:$HEIGHT:force_original_aspect_ratio=increase:flags=lanczos,crop=$WIDTH:$HEIGHT" \
  -c:v libx264 -crf 16 "$WORK/source.mp4"

# 2. Edge treatment: multiply by a mask that fades the top (hides anything poking
#    in above the pour, e.g. a bottle lip), the bottom (hides table seams), and an
#    oval vignette around the glass, so the frame melts into the dark cellar band.
if [ "$TREAT" -eq 1 ]; then
  ffmpeg -loglevel error -y -f lavfi -i "color=black:s=${WIDTH}x${HEIGHT},format=gray" \
    -vf "geq=lum='255*clip(Y/(H*0.16),0,1)*clip((H-Y)/(H*0.12),0,1)*clip((1.08-hypot((X-W*0.555)/(W*0.62),(Y-H*0.52)/(H*0.78)))/0.5,0,1)'" \
    -frames:v 1 "$WORK/mask.png"
  ffmpeg -loglevel error -y -i "$WORK/source.mp4" -loop 1 -i "$WORK/mask.png" \
    -filter_complex "[1:v]format=gbrp[m];[0:v]format=gbrp[v];[v][m]blend=all_mode=multiply:shortest=1,format=yuv420p" \
    -c:v libx264 -crf 16 "$WORK/treated.mp4"
else
  cp "$WORK/source.mp4" "$WORK/treated.mp4"
fi

# 3. Export both sets from the same timeline so they always have equal counts.
export_set() {
  local name="$1" filter="$2"
  local dir="$WORK/$name"
  mkdir -p "$dir"
  ffmpeg -loglevel error -y -i "$WORK/treated.mp4" -vf "$filter" -c:v libwebp -quality "$QUALITY" "$dir/frame-%03d.webp"
  cp "$dir/frame-001.webp" "$dir/poster.webp"
}
export_set desktop "fps=$FPS"
export_set mobile "fps=$FPS,crop=$MOBILE_WIDTH:$HEIGHT:$MOBILE_X:0"

DESKTOP_COUNT=$(ls "$WORK/desktop"/frame-*.webp | wc -l | tr -d ' ')
MOBILE_COUNT=$(ls "$WORK/mobile"/frame-*.webp | wc -l | tr -d ' ')
[ "$DESKTOP_COUNT" = "$MOBILE_COUNT" ] || { echo "Frame counts differ ($DESKTOP_COUNT vs $MOBILE_COUNT)" >&2; exit 1; }

# 4. Replace the published sets only after everything above succeeded.
mkdir -p "$OUT_DIR"
for name in desktop mobile; do
  rm -rf "$OUT_DIR/$name"
  mv "$WORK/$name" "$OUT_DIR/$name"
done

echo "desktop: $DESKTOP_COUNT frames, $(du -sh "$OUT_DIR/desktop" | cut -f1)"
echo "mobile:  $MOBILE_COUNT frames, $(du -sh "$OUT_DIR/mobile" | cut -f1)"
echo "Next: set HERO_FRAME_COUNT = $DESKTOP_COUNT in frontend/src/utils/frameSequence.ts"
