#!/usr/bin/env bash
set -euo pipefail

# SUPERSEDED by scripts/build-release-from-source.sh, which builds the shipping
# artifacts from upstream/marktext sources instead of re-patching an installed
# binary. Kept for reference and for reproducing pre-1.2.0 releases; note that
# its `npx asar pack` step silently drops the electron-builder asarUnpack rules.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-1.1.0}"
DEFAULT_SOURCE_APP="/Applications/Reversion.app"
if [[ ! -d "$DEFAULT_SOURCE_APP" && -d "/Applications/MarkText.app" ]]; then
  DEFAULT_SOURCE_APP="/Applications/MarkText.app"
fi
SOURCE_APP="${2:-$DEFAULT_SOURCE_APP}"
OUT_DIR="${3:-$ROOT/releases}"
ARCH="arm64"
APP_NAME="Reversion.app"
BASE_NAME="Reversion-$VERSION-$ARCH"
ZIP="$OUT_DIR/$BASE_NAME-mac.zip"
DMG="$OUT_DIR/$BASE_NAME.dmg"
MANIFEST="$OUT_DIR/latest-mac.yml"
WORK="$(mktemp -d "$ROOT/.tmp/marktext-release-$VERSION.XXXXXX")"
STAGED_APP="$WORK/$APP_NAME"
EXTRACTED="$WORK/extracted"
PATCHED_ASAR="$WORK/app.asar"
DMG_STAGE="$WORK/dmg-stage"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Version must use semantic versioning: $VERSION" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "Reversion/MarkText app not found: $SOURCE_APP" >&2
  exit 1
fi

for output in "$ZIP" "$DMG" "$MANIFEST" "$ZIP.sha256" "$DMG.sha256"; do
  if [[ -e "$output" ]]; then
    echo "Release output already exists: $output" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR" "$EXTRACTED" "$DMG_STAGE"
ditto "$SOURCE_APP" "$STAGED_APP"

ASAR="$STAGED_APP/Contents/Resources/app.asar"
npm_config_cache="$ROOT/.npm-cache" npx --yes asar extract "$ASAR" "$EXTRACTED"
LENS_RELEASE_VERSION="$VERSION" node "$ROOT/scripts/patch-asar-themes.mjs" "$EXTRACTED"
npm_config_cache="$ROOT/.npm-cache" npx --yes asar pack "$EXTRACTED" "$PATCHED_ASAR"
cp "$PATCHED_ASAR" "$ASAR"
cp "$ROOT/config/app-update.yml" "$STAGED_APP/Contents/Resources/app-update.yml"
"$ROOT/scripts/brand-app.sh" "$STAGED_APP"
REVERSION_VERSION="$VERSION" "$ROOT/scripts/build-quicklook.sh" "$STAGED_APP/Contents/PlugIns"

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$STAGED_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$STAGED_APP/Contents/Info.plist"

if [[ ! -f "$ROOT/icon/lens-marktext-icon.icns" || ! -f "$ROOT/icon/lens-marktext-icon.png" ]]; then
  "$ROOT/scripts/build-icon.sh"
fi
cp "$ROOT/icon/lens-marktext-icon.icns" "$STAGED_APP/Contents/Resources/icon.icns"
cp "$ROOT/icon/lens-marktext-icon.icns" "$STAGED_APP/Contents/Resources/static/icon.icns"
cp "$ROOT/icon/lens-marktext-icon.png" "$STAGED_APP/Contents/Resources/static/icon.png"

find "$STAGED_APP" \( -name '*.lens-backup-*' -o -name '*.lens-*-backup-*' \) -delete
xattr -cr "$STAGED_APP"
codesign --force --deep --sign - "$STAGED_APP"
codesign --force --sign - --requirements '=designated => identifier "com.github.marktext.marktext.reversion-quicklook"' --entitlements "$ROOT/quicklook/ReversionQuickLook.entitlements" "$STAGED_APP/Contents/PlugIns/ReversionQuickLook.appex"
codesign --force --sign - --requirements '=designated => identifier "com.github.marktext.marktext"' "$STAGED_APP"
codesign --verify --deep --strict --verbose=2 "$STAGED_APP"
codesign --verify --deep --strict -R '=identifier "com.github.marktext.marktext"' "$STAGED_APP"
file "$STAGED_APP/Contents/MacOS/marktext" | grep -q 'arm64'

ditto -c -k --sequesterRsrc --keepParent "$STAGED_APP" "$ZIP"
node "$ROOT/scripts/make-update-manifest.mjs" "$VERSION" "$ZIP" "$MANIFEST"

ditto "$STAGED_APP" "$DMG_STAGE/$APP_NAME"
ln -s /Applications "$DMG_STAGE/Applications"
cp "$ROOT/README.md" "$ROOT/README.zh-CN.md" "$ROOT/LICENSE" "$ROOT/NOTICE.md" "$DMG_STAGE/"
mkdir -p "$DMG_STAGE/Lens Themes" "$DMG_STAGE/UPSTREAM_LICENSES"
cp "$ROOT/themes/export/lens-design.css" "$DMG_STAGE/Lens Themes/lens-design-export.css"
cp "$ROOT/themes/export/claude-like.css" "$DMG_STAGE/Lens Themes/claude-like-export.css"
cp "$ROOT/UPSTREAM_LICENSES/MarkText-MIT-LICENSE.txt" "$DMG_STAGE/UPSTREAM_LICENSES/"
hdiutil create -volname "Reversion $VERSION" -srcfolder "$DMG_STAGE" -format UDZO "$DMG"

(cd "$OUT_DIR" && shasum -a 256 "$(basename "$ZIP")" > "$(basename "$ZIP").sha256")
(cd "$OUT_DIR" && shasum -a 256 "$(basename "$DMG")" > "$(basename "$DMG").sha256")

echo "Release artifacts:"
echo "  $DMG"
echo "  $ZIP"
echo "  $MANIFEST"
echo "  $DMG.sha256"
echo "  $ZIP.sha256"
echo "Staged app: $STAGED_APP"
echo "Work dir kept for inspection: $WORK"
