#!/usr/bin/env bash
set -euo pipefail

# Post-packaging branding for the Reversion .app bundle.
#
# Scope note (B2 productName migration): CFBundleName / CFBundleDisplayName /
# CFBundleExecutable and the four `Reversion Helper*.app` bundles are now set
# natively by electron-builder from `productName: Reversion`
# (packages/desktop/electron-builder.yml), so this script no longer rewrites
# them -- it only verifies them, so a productName regression fails the release
# here instead of shipping a bundle whose Finder/menu-bar name silently
# reverted. What is still this script's job, because electron-builder has no
# equivalent knob:
#   * the localized display names (en / zh-Hans / zh-Hant InfoPlist.strings,
#     which is where 反文 comes from on Chinese systems)
#   * collapsing the six per-extension Markdown declarations onto the system
#     UTI net.daringfireball.markdown
#
# Idempotent: safe to re-run against an already-branded bundle.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:?Usage: brand-app.sh <path-to-app>}"
PLIST="$APP/Contents/Info.plist"
MARKDOWN_UTI="net.daringfireball.markdown"
PRODUCT_NAME="Reversion"

if [[ ! -f "$PLIST" ]]; then
  echo "Application Info.plist not found: $PLIST" >&2
  exit 1
fi

plist_get() { /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" 2>/dev/null; }

for key in CFBundleName CFBundleDisplayName CFBundleExecutable; do
  actual="$(plist_get "$key" || true)"
  if [[ "$actual" != "$PRODUCT_NAME" ]]; then
    echo "$key is '$actual', expected '$PRODUCT_NAME'." >&2
    echo "electron-builder derives all three from productName; check packages/desktop/electron-builder.yml." >&2
    exit 1
  fi
done

# Electron's main delegate resolves its helper apps from CFBundleName at
# runtime (electron_main_delegate_mac.mm), so a mismatch between the verified
# name above and the Frameworks/ directory names is a launch-time crash
# ("Unable to find helper app"), not a cosmetic problem. Fail here instead.
for helper in "" " (GPU)" " (Plugin)" " (Renderer)"; do
  helper_app="$APP/Contents/Frameworks/$PRODUCT_NAME Helper$helper.app"
  [[ -d "$helper_app" ]] || { echo "missing helper bundle: $helper_app" >&2; exit 1; }
done

/usr/libexec/PlistBuddy -c "Delete :UTExportedTypeDeclarations" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Delete :UTImportedTypeDeclarations" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0 dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeIdentifier string $MARKDOWN_UTI" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeDescription string Reversion Markdown Document" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeConformsTo array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeConformsTo:0 string public.text" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeConformsTo:1 string public.data" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeTagSpecification dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension array" "$PLIST"
for extension in md markdown mmd mdown mdtxt mdtext; do
  extension_index=$(/usr/libexec/PlistBuddy -c "Print :UTImportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension" "$PLIST" | grep -c '^    ' || true)
  /usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension:$extension_index string $extension" "$PLIST"
done
/usr/libexec/PlistBuddy -c "Add :UTImportedTypeDeclarations:0:UTTypeTagSpecification:public.mime-type string text/markdown" "$PLIST"

document_index=0
while /usr/libexec/PlistBuddy -c "Print :CFBundleDocumentTypes:$document_index" "$PLIST" >/dev/null 2>&1; do
  /usr/libexec/PlistBuddy -c "Delete :CFBundleDocumentTypes:$document_index:LSItemContentTypes" "$PLIST" >/dev/null 2>&1 || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:$document_index:LSItemContentTypes array" "$PLIST"
  /usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:$document_index:LSItemContentTypes:0 string $MARKDOWN_UTI" "$PLIST"
  document_index=$((document_index + 1))
done

for locale in en zh-Hans zh-Hant; do
  mkdir -p "$APP/Contents/Resources/$locale.lproj"
  cp "$ROOT/config/InfoPlist.$locale.strings" "$APP/Contents/Resources/$locale.lproj/InfoPlist.strings"
done

echo "Branded application as Reversion / 反文: $APP"
