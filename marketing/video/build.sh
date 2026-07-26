#!/bin/bash
# Assembles the PodFinder walkthrough video from clips.json.
# Usage: ./build.sh [15s|30s|60s]   (default: all clips, ~30s)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

CLIPS_JSON="clips.json"
OUT_DIR="output"
TMP_DIR="$OUT_DIR/tmp"
CAPTION_TEMPLATE_URL="file://$DIR/caption_template.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$TMP_DIR"
rm -f "$TMP_DIR"/*.mp4 "$TMP_DIR"/*.png

W=$(jq -r '.canvas.width' "$CLIPS_JSON")
H=$(jq -r '.canvas.height' "$CLIPS_JSON")
BG=$(jq -r '.canvas.bg' "$CLIPS_JSON")
FPS=$(jq -r '.canvas.fps' "$CLIPS_JSON")

N=$(jq -r '.clips | length' "$CLIPS_JSON")
CONCAT_LIST="$TMP_DIR/concat.txt"
> "$CONCAT_LIST"

for i in $(seq 0 $((N - 1))); do
  clip=$(jq -c ".clips[$i]" "$CLIPS_JSON")
  id=$(echo "$clip" | jq -r '.id')
  file=$(echo "$clip" | jq -r '.file')
  duration=$(echo "$clip" | jq -r '.duration')
  caption=$(echo "$clip" | jq -r '.caption')

  # Static frame, no zoom/pan: outro (brand kit PNG) fills the canvas
  # directly, phone screenshots are letterboxed to fit.
  if [[ "$id" == "11_outro" ]]; then
    scale_pad="scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}"
  else
    scale_pad="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}"
  fi

  # Caption bar is rendered as a PNG via headless Chrome (same technique as
  # the Phase A brand kit) since Homebrew's ffmpeg build has no drawtext/freetype.
  caption_png="$TMP_DIR/${id}_caption.png"
  encoded_text=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$caption")
  "$CHROME" --headless --disable-gpu --force-device-scale-factor=1 --window-size=1080,340 \
    --screenshot="$caption_png" --virtual-time-budget=1500 \
    "${CAPTION_TEMPLATE_URL}?text=${encoded_text}" 2>/dev/null

  out="$TMP_DIR/${id}.mp4"
  echo "Building clip: $id ($caption)"
  ffmpeg -y -loglevel error -loop 1 -i "$file" -loop 1 -i "$caption_png" \
    -filter_complex "[0:v]${scale_pad}[bg];[bg][1:v]overlay=x=0:y=H-h[merged];[merged]fade=t=in:st=0:d=0.3,fade=t=out:st=$(python3 -c "print(${duration}-0.3)"):d=0.3[out]" \
    -map "[out]" -t "$duration" -r "$FPS" -pix_fmt yuv420p -c:v libx264 -crf 18 "$out"

  echo "file '$(basename "$out")'" >> "$CONCAT_LIST"
done

CUT="${1:-all}"
FINAL="$OUT_DIR/podfinder-walkthrough-${CUT}.mp4"

if [[ "$CUT" == "all" ]]; then
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$FINAL"
else
  ids=$(jq -r --arg cut "$CUT" '.cuts[$cut] // empty' shotlist.json 2>/dev/null || true)
  echo "Named cuts are defined in shotlist.json; rerun with 'all' or build a filtered concat.txt manually for now."
  exit 1
fi

echo "Done: $FINAL"
