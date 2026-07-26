#!/usr/bin/env bash
set -euo pipefail

# Reversion release pipeline — source-built edition.
#
# Builds the shipping macOS artifacts straight from the patched upstream
# sources in upstream/marktext (branch reversion/main) instead of re-patching a
# prebuilt app.asar. Supersedes scripts/build-release.sh.
#
# Usage:
#   scripts/build-release-from-source.sh <version> [output-dir]
#
# Environment knobs (all optional):
#   REVERSION_NODE_BIN=/path/to/node   Use this Node binary (must match .nvmrc).
#   REVERSION_BOOTSTRAP_NODE=1         Provision the pinned Node into .tmp/toolchain.
#   REVERSION_UPSTREAM_DIR=/path       Override the upstream checkout location.
#   REVERSION_KEEP_VERSION=1           Leave the version written into the upstream
#                                      package.json instead of restoring it.
#   REVERSION_SKIP_QUICKLOOK=1         Skip the Quick Look extension (needs xcodegen).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: build-release-from-source.sh <version> [output-dir]" >&2
  exit 1
fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Version must use semantic versioning: $VERSION" >&2
  exit 1
fi

OUT_DIR="${2:-$ROOT/releases/$VERSION}"
UPSTREAM="${REVERSION_UPSTREAM_DIR:-$ROOT/upstream/marktext}"
DESKTOP="$UPSTREAM/packages/desktop"
ARCH="arm64"
APP_NAME="Reversion.app"
# electron-builder's `productName` (packages/desktop/electron-builder.yml).
# Since the B2 migration it drives the bundle directory name, CFBundleName,
# CFBundleDisplayName, CFBundleExecutable and the four Helper bundle names, so
# every path below derives from this one constant instead of hardcoding
# "marktext" the way the pre-1.2.0 pipeline did.
PRODUCT_NAME="Reversion"
APP_ID="com.github.marktext.marktext"
QUICKLOOK_ID="com.github.marktext.marktext.reversion-quicklook"
BASE_NAME="Reversion-$VERSION-$ARCH"
ZIP="$OUT_DIR/$BASE_NAME-mac.zip"
DMG="$OUT_DIR/$BASE_NAME.dmg"
MANIFEST="$OUT_DIR/latest-mac.yml"
TOOLCHAIN="$ROOT/.tmp/toolchain"
BUILD_LOG_PREFIX="[reversion-release]"

log() { echo "$BUILD_LOG_PREFIX $*"; }
fail() { echo "$BUILD_LOG_PREFIX ERROR: $*" >&2; exit 1; }

[[ -d "$UPSTREAM" ]] || fail "upstream checkout not found: $UPSTREAM"
[[ -f "$DESKTOP/package.json" ]] || fail "upstream desktop package not found: $DESKTOP/package.json"
[[ "$(uname -s)" == "Darwin" ]] || fail "this pipeline only builds macOS artifacts"

for output in "$ZIP" "$DMG" "$MANIFEST" "$ZIP.sha256" "$DMG.sha256"; do
  [[ -e "$output" ]] && fail "release output already exists: $output"
done

# ---------------------------------------------------------------------------
# 1. Toolchain: pin Node to .nvmrc and pnpm to the upstream packageManager field
# ---------------------------------------------------------------------------

NODE_VERSION="$(tr -d '[:space:]' < "$ROOT/.nvmrc")"
[[ -n "$NODE_VERSION" ]] || fail ".nvmrc is empty; it must pin the Node version used by upstream CI"
PNPM_VERSION="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([^"]*\)".*/\1/p' "$UPSTREAM/package.json")"
[[ -n "$PNPM_VERSION" ]] || fail "cannot read packageManager from $UPSTREAM/package.json"

NODE_DIST="node-v$NODE_VERSION-darwin-$ARCH"
NODE_HOME="$TOOLCHAIN/$NODE_DIST"

node_version_of() { "$1" -v 2>/dev/null | sed 's/^v//'; }

resolve_node() {
  local candidate
  for candidate in \
    "${REVERSION_NODE_BIN:-}" \
    "$NODE_HOME/bin/node" \
    "$HOME/.nvm/versions/node/v$NODE_VERSION/bin/node" \
    "$HOME/.local/share/fnm/node-versions/v$NODE_VERSION/installation/bin/node" \
    "$HOME/.local/share/mise/installs/node/$NODE_VERSION/bin/node" \
    "$HOME/.volta/tools/image/node/$NODE_VERSION/bin/node" \
    "/opt/homebrew/opt/node@${NODE_VERSION%%.*}/bin/node" \
    "$(command -v node || true)"
  do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    [[ "$(node_version_of "$candidate")" == "$NODE_VERSION" ]] || continue
    printf '%s' "$candidate"
    return 0
  done
  return 1
}

bootstrap_node() {
  local base="https://nodejs.org/dist/v$NODE_VERSION"
  local tarball="$TOOLCHAIN/$NODE_DIST.tar.gz"
  log "provisioning Node $NODE_VERSION into $TOOLCHAIN (repo-local, system Node untouched)"
  mkdir -p "$TOOLCHAIN"
  curl -fsSL -o "$tarball" "$base/$NODE_DIST.tar.gz"
  curl -fsSL -o "$TOOLCHAIN/SHASUMS256.txt" "$base/SHASUMS256.txt"
  ( cd "$TOOLCHAIN" && grep " $NODE_DIST.tar.gz\$" SHASUMS256.txt | shasum -a 256 -c - ) \
    || fail "checksum mismatch for $NODE_DIST.tar.gz"
  rm -rf "$NODE_HOME"
  tar -xzf "$tarball" -C "$TOOLCHAIN"
}

if ! NODE_BIN="$(resolve_node)"; then
  if [[ "${REVERSION_BOOTSTRAP_NODE:-0}" == "1" ]]; then
    bootstrap_node
    NODE_BIN="$(resolve_node)" || fail "bootstrap finished but Node $NODE_VERSION is still not usable"
  else
    cat >&2 <<EOF
$BUILD_LOG_PREFIX ERROR: Node $NODE_VERSION is required (pinned in .nvmrc, matching
upstream CI .github/workflows/release.yml). Found: $(node -v 2>/dev/null || echo 'no node on PATH').

Pick one, then re-run:
  1. Let this script provision it into .tmp/toolchain (nothing outside the repo changes):
       REVERSION_BOOTSTRAP_NODE=1 scripts/build-release-from-source.sh $VERSION
  2. Install it with a version manager and re-run inside that shell:
       nvm install $NODE_VERSION && nvm use $NODE_VERSION
       fnm install $NODE_VERSION && fnm use $NODE_VERSION
       mise use node@$NODE_VERSION
  3. Point the script at an existing install:
       REVERSION_NODE_BIN=/path/to/node-v$NODE_VERSION/bin/node scripts/build-release-from-source.sh $VERSION

Do not "just use" the system Node: the shipping binary must come from the same
toolchain upstream CI uses.
EOF
    exit 1
  fi
fi

NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"
export PATH="$NODE_DIR:$PATH"
hash -r
log "node $(node -v) ($NODE_BIN)"

PNPM_HOME="$TOOLCHAIN/pnpm-$PNPM_VERSION"
PNPM_BIN="$PNPM_HOME/node_modules/.bin/pnpm"
if [[ ! -x "$PNPM_BIN" ]] || [[ "$("$PNPM_BIN" --version 2>/dev/null)" != "$PNPM_VERSION" ]]; then
  log "provisioning pnpm $PNPM_VERSION into $PNPM_HOME"
  mkdir -p "$PNPM_HOME"
  npm install --prefix "$PNPM_HOME" --no-audit --no-fund --silent "pnpm@$PNPM_VERSION"
fi
export PATH="$PNPM_HOME/node_modules/.bin:$PATH"
hash -r
log "pnpm $(pnpm --version)"

# ---------------------------------------------------------------------------
# 2. Release feed: config/app-update.yml is the single source of truth
# ---------------------------------------------------------------------------
# electron-builder derives Resources/app-update.yml from electron-builder.yml's
# `publish` block, but it hardcodes updaterCacheDirName from package.json `name`
# (app-builder-lib AppInfo.updaterCacheDirName = sanitizedName + "-updater"),
# which cannot be overridden in config. Reversion ships "reversion-updater"
# while the workspace package stays named "marktext", so the generated file is
# always wrong on that one field and must be replaced. To keep the two files
# from drifting, the owner/repo/provider triple is cross-checked here.

APP_UPDATE_SRC="$ROOT/config/app-update.yml"
[[ -f "$APP_UPDATE_SRC" ]] || fail "missing $APP_UPDATE_SRC"
BUILDER_YML="$DESKTOP/electron-builder.yml"
[[ -f "$BUILDER_YML" ]] || fail "missing $BUILDER_YML"

yaml_scalar() { sed -n "s/^[[:space:]]*$2:[[:space:]]*\([^[:space:]#]*\).*/\1/p" "$1" | head -1; }

for field in provider owner repo; do
  from_config="$(yaml_scalar "$APP_UPDATE_SRC" "$field")"
  from_builder="$(sed -n '/^publish:/,/^[a-zA-Z]/p' "$BUILDER_YML" | yaml_scalar /dev/stdin "$field")"
  [[ -n "$from_config" ]] || fail "config/app-update.yml is missing '$field'"
  if [[ "$from_config" != "$from_builder" ]]; then
    fail "release feed drift on '$field': config/app-update.yml=$from_config electron-builder.yml publish=$from_builder"
  fi
done
UPDATER_CACHE_DIR_NAME="$(yaml_scalar "$APP_UPDATE_SRC" updaterCacheDirName)"
[[ -n "$UPDATER_CACHE_DIR_NAME" ]] || fail "config/app-update.yml is missing 'updaterCacheDirName'"
log "release feed verified: $(yaml_scalar "$APP_UPDATE_SRC" owner)/$(yaml_scalar "$APP_UPDATE_SRC" repo) (cache dir $UPDATER_CACHE_DIR_NAME)"

# ---------------------------------------------------------------------------
# 3. Version: written into the source before the build, not patched afterwards
# ---------------------------------------------------------------------------
# electron.vite.config.ts injects MARKTEXT_VERSION / MARKTEXT_VERSION_STRING via
# `define` from packages/desktop/package.json, and electron-builder reads the
# same field for CFBundleShortVersionString. One write covers all three.

DESKTOP_PKG="$DESKTOP/package.json"
DESKTOP_PKG_BACKUP="$(mktemp "${TMPDIR:-/tmp}/reversion-desktop-package.XXXXXX.json")"
cp "$DESKTOP_PKG" "$DESKTOP_PKG_BACKUP"
restore_version() {
  if [[ "${REVERSION_KEEP_VERSION:-0}" == "1" ]]; then
    log "keeping version $VERSION in $DESKTOP_PKG (REVERSION_KEEP_VERSION=1)"
  elif [[ -f "$DESKTOP_PKG_BACKUP" ]]; then
    cp "$DESKTOP_PKG_BACKUP" "$DESKTOP_PKG"
  fi
  rm -f "$DESKTOP_PKG_BACKUP"
}
trap restore_version EXIT

node -e '
const fs = require("fs");
const [file, version] = process.argv.slice(1);
const text = fs.readFileSync(file, "utf8");
const next = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
if (next === text) { throw new Error("version field not found in " + file); }
if (JSON.parse(next).version !== version) { throw new Error("version rewrite did not take effect"); }
fs.writeFileSync(file, next);
' "$DESKTOP_PKG" "$VERSION"
log "version $VERSION written into $DESKTOP_PKG"

# ---------------------------------------------------------------------------
# 4. Build from source
# ---------------------------------------------------------------------------

log "installing dependencies (frozen lockfile, scripts deferred to postinstall)"
( cd "$UPSTREAM" && pnpm install --frozen-lockfile --ignore-scripts )

log "running upstream postinstall (electron download, patch-package, electron-rebuild)"
( cd "$UPSTREAM" && CXXFLAGS="-std=gnu++20 -stdlib=libc++" npm_config_user_agent="pnpm" pnpm tsx scripts/postinstall.ts )

log "building renderer/main/preload bundles"
( cd "$UPSTREAM" && pnpm run build:unpack )

BUNDLE_MAIN="$DESKTOP/out/main/index.js"
[[ -f "$BUNDLE_MAIN" ]] || fail "electron-vite did not produce $BUNDLE_MAIN"
grep -q "\"$VERSION\"" "$BUNDLE_MAIN" || fail "MARKTEXT_VERSION was not injected as $VERSION into $BUNDLE_MAIN"

log "packaging the app bundle (electron-builder --dir, ad-hoc signing, no notarization)"
rm -rf "$UPSTREAM/dist/mac-$ARCH"
( cd "$DESKTOP" && CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --"$ARCH" --dir --publish never )

BUILT_APP="$UPSTREAM/dist/mac-$ARCH/$PRODUCT_NAME.app"
[[ -d "$BUILT_APP" ]] || fail "electron-builder did not produce $BUILT_APP"

# The bundle name above, CFBundleName, and the Helper directory names all come
# from the same productName. Electron resolves its helper apps from
# CFBundleName at runtime, so any drift between them is a launch-time crash --
# assert on the raw electron-builder output before anything else touches it.
BUILT_BUNDLE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$BUILT_APP/Contents/Info.plist")"
[[ "$BUILT_BUNDLE_NAME" == "$PRODUCT_NAME" ]] \
  || fail "CFBundleName is '$BUILT_BUNDLE_NAME', expected '$PRODUCT_NAME' (electron-builder.yml productName)"
[[ -x "$BUILT_APP/Contents/MacOS/$PRODUCT_NAME" ]] \
  || fail "missing executable $BUILT_APP/Contents/MacOS/$PRODUCT_NAME"
for helper in "" " (GPU)" " (Plugin)" " (Renderer)"; do
  [[ -d "$BUILT_APP/Contents/Frameworks/$PRODUCT_NAME Helper$helper.app" ]] \
    || fail "missing helper bundle: $PRODUCT_NAME Helper$helper.app"
done
log "bundle naming verified: $PRODUCT_NAME.app + 4 $PRODUCT_NAME Helper*.app (CFBundleName=$BUILT_BUNDLE_NAME)"

# The old pipeline re-packed app.asar with `npx asar pack`, silently dropping the
# asarUnpack rules. Source-built output must keep them.
[[ -d "$BUILT_APP/Contents/Resources/app.asar.unpacked" ]] \
  || fail "app.asar.unpacked is missing; asarUnpack rules were lost"
UNPACKED_COUNT="$(find "$BUILT_APP/Contents/Resources/app.asar.unpacked" -type f | wc -l | tr -d ' ')"
[[ "$UNPACKED_COUNT" -gt 0 ]] || fail "app.asar.unpacked is empty; asarUnpack rules were lost"
log "asarUnpack preserved: $UNPACKED_COUNT unpacked files"

# ---------------------------------------------------------------------------
# 5. Stage and brand the bundle
# ---------------------------------------------------------------------------

WORK="$(mktemp -d "$ROOT/.tmp/reversion-release-$VERSION.XXXXXX")"
STAGED_APP="$WORK/$APP_NAME"
DMG_STAGE="$WORK/dmg-stage"
mkdir -p "$OUT_DIR" "$DMG_STAGE"
ditto "$BUILT_APP" "$STAGED_APP"

cp "$APP_UPDATE_SRC" "$STAGED_APP/Contents/Resources/app-update.yml"
"$ROOT/scripts/brand-app.sh" "$STAGED_APP"

if [[ "${REVERSION_SKIP_QUICKLOOK:-0}" == "1" ]]; then
  log "skipping Quick Look extension (REVERSION_SKIP_QUICKLOOK=1)"
else
  REVERSION_VERSION="$VERSION" "$ROOT/scripts/build-quicklook.sh" "$STAGED_APP/Contents/PlugIns"
fi

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$STAGED_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$STAGED_APP/Contents/Info.plist"

# Icon install — same kernel as scripts/install-icon.sh, minus the backup/cache
# handling that only makes sense against an already-installed bundle.
if [[ ! -f "$ROOT/icon/lens-marktext-icon.icns" || ! -f "$ROOT/icon/lens-marktext-icon.png" ]]; then
  "$ROOT/scripts/build-icon.sh"
fi
cp "$ROOT/icon/lens-marktext-icon.icns" "$STAGED_APP/Contents/Resources/icon.icns"
cp "$ROOT/icon/lens-marktext-icon.icns" "$STAGED_APP/Contents/Resources/static/icon.icns"
cp "$ROOT/icon/lens-marktext-icon.png" "$STAGED_APP/Contents/Resources/static/icon.png"

find "$STAGED_APP" \( -name '*.lens-backup-*' -o -name '*.lens-*-backup-*' \) -delete
xattr -cr "$STAGED_APP"

# ---------------------------------------------------------------------------
# 6. Stable ad-hoc signing identity
# ---------------------------------------------------------------------------
# Plain `codesign --sign -` produces a designated requirement pinned to the
# bundle's cdhash, so a 1.1.0 install would reject any later build. Re-signing
# with an explicit identifier-based designated requirement makes every Reversion
# build satisfy every other Reversion build's requirement, which is what
# Squirrel.Mac checks when swapping the bundle in place.

codesign --force --deep --sign - "$STAGED_APP"
if [[ -d "$STAGED_APP/Contents/PlugIns/ReversionQuickLook.appex" ]]; then
  codesign --force --sign - \
    --requirements "=designated => identifier \"$QUICKLOOK_ID\"" \
    --entitlements "$ROOT/quicklook/ReversionQuickLook.entitlements" \
    "$STAGED_APP/Contents/PlugIns/ReversionQuickLook.appex"
fi
codesign --force --sign - --requirements "=designated => identifier \"$APP_ID\"" "$STAGED_APP"
codesign --verify --deep --strict --verbose=2 "$STAGED_APP"
codesign --verify --deep --strict -R "=identifier \"$APP_ID\"" "$STAGED_APP"
file "$STAGED_APP/Contents/MacOS/$PRODUCT_NAME" | grep -q 'arm64'

# ---------------------------------------------------------------------------
# 7. Post-conditions on the shipping bundle
# ---------------------------------------------------------------------------

STAGED_UPDATE_YML="$STAGED_APP/Contents/Resources/app-update.yml"
grep -q "^updaterCacheDirName: $UPDATER_CACHE_DIR_NAME\$" "$STAGED_UPDATE_YML" \
  || fail "staged app-update.yml does not pin updaterCacheDirName=$UPDATER_CACHE_DIR_NAME"
grep -q "^owner: $(yaml_scalar "$APP_UPDATE_SRC" owner)\$" "$STAGED_UPDATE_YML" \
  || fail "staged app-update.yml has the wrong owner"
grep -q "^repo: $(yaml_scalar "$APP_UPDATE_SRC" repo)\$" "$STAGED_UPDATE_YML" \
  || fail "staged app-update.yml has the wrong repo"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$STAGED_APP/Contents/Info.plist")" == "$APP_ID" ]] \
  || fail "CFBundleIdentifier drifted away from $APP_ID"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$STAGED_APP/Contents/Info.plist")" == "$VERSION" ]] \
  || fail "CFBundleShortVersionString is not $VERSION"
# The B2 acceptance criterion: the macOS menu-bar application menu title and the
# Dock tile name are driven by CFBundleName on current macOS, so this is the one
# field that decides whether the shipped app says "Reversion" or "marktext"
# where users actually look. Re-asserted on the signed bundle.
for key in CFBundleName CFBundleDisplayName CFBundleExecutable; do
  [[ "$(/usr/libexec/PlistBuddy -c "Print :$key" "$STAGED_APP/Contents/Info.plist")" == "$PRODUCT_NAME" ]] \
    || fail "$key drifted away from $PRODUCT_NAME in the shipping bundle"
done

# ---------------------------------------------------------------------------
# 8. Artifacts
# ---------------------------------------------------------------------------

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

echo
echo "Release artifacts:"
echo "  $DMG"
echo "  $ZIP"
echo "  $MANIFEST"
echo "  $DMG.sha256"
echo "  $ZIP.sha256"
echo "Staged app: $STAGED_APP"
echo "Work dir kept for inspection: $WORK"
