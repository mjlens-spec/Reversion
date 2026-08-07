#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Current production icon source. Release builds use the same asset.
DEFAULT_SRC="$ROOT/icon/reversion-hand-pencil-engraving_OC_0807B.png"
SRC="${1:-"$DEFAULT_SRC"}"
OUT="$ROOT/icon/build"
ICONSET="$OUT/LensMarkText.iconset"

mkdir -p "$ICONSET"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 'magick' is required. Install with: brew install imagemagick" >&2
  exit 1
fi

render_png() {
  local size="$1"
  local name="$2"
  magick -background none "$SRC" \
    -resize "${size}x${size}" \
    -depth 8 \
    -strip \
    -define png:exclude-chunks=date,time \
    "PNG32:$ICONSET/$name"
}

render_png 16 "icon_16x16.png"
render_png 32 "icon_16x16@2x.png"
render_png 32 "icon_32x32.png"
render_png 64 "icon_32x32@2x.png"
render_png 128 "icon_128x128.png"
render_png 256 "icon_128x128@2x.png"
render_png 256 "icon_256x256.png"
render_png 512 "icon_256x256@2x.png"
render_png 512 "icon_512x512.png"
render_png 1024 "icon_512x512@2x.png"

node "$ROOT/scripts/make-icns.mjs" "$ICONSET" "$ROOT/icon/lens-marktext-icon.icns"
cp "$ICONSET/icon_512x512@2x.png" "$ROOT/icon/lens-marktext-icon.png"

echo "Built:"
echo "  $ROOT/icon/lens-marktext-icon.icns"
echo "  $ROOT/icon/lens-marktext-icon.png"
