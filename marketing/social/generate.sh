#!/bin/bash
# Renders every entry in manifest.json to a high-res PNG via headless Chrome.
# Usage: ./generate.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TEMPLATE_URL="file://$DIR/template.html"
OUT_DIR="output"
mkdir -p "$OUT_DIR"

SIZES_square="1080x1080"
SIZES_portrait="1080x1350"
SIZES_story="1080x1920"

N=$(jq -r 'length' manifest.json)

for i in $(seq 0 $((N - 1))); do
  entry=$(jq -c ".[$i]" manifest.json)
  out=$(echo "$entry" | jq -r '.out')
  size=$(echo "$entry" | jq -r '.size')

  case "$size" in
    square) dims="$SIZES_square" ;;
    portrait) dims="$SIZES_portrait" ;;
    story) dims="$SIZES_story" ;;
    *) echo "Unknown size: $size"; exit 1 ;;
  esac
  w="${dims%x*}"
  h="${dims#*x}"

  query=$(echo "$entry" | jq -r '.params | to_entries | map("\(.key)=\(.value|@uri)") | join("&")')
  query="size=${size}&${query}"

  echo "Rendering: $out ($size, ${w}x${h})"
  "$CHROME" --headless --disable-gpu --force-device-scale-factor=2 --window-size="${w},${h}" \
    --screenshot="$OUT_DIR/$out" --virtual-time-budget=2000 \
    "${TEMPLATE_URL}?${query}" 2>/dev/null
done

echo "Done. Assets in $OUT_DIR/"
