import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const rendererFixture = `
const patchTheme = (css) => {
  switch (theme) {
    case "light":
      break;
  }
};
const themes = [
  // Light Themes (alphabetical)
];
const rightColumn = /* @__PURE__ */ ref$1("files");
const preferenceDefaults = {
    language: "en",
    editorFontFamily: "Open Sans",
    fontSize: 16,
    lineHeight: 1.6
};
const editorFontFamily = { "description": "Editor--editor font family", "type": "string", "pattern": "^[^\\\\s]+((-|\\\\s)*[^\\\\s])*$", "default": "Open Sans" };
const fontSize = { "description": "Editor--Font size in pixels", "type": "number", "default": 16 };
const schema = {
  language,
  editorFontFamily,
  fontSize,
  lineHeight,
};
function RESTORE_BUFFERED_STATE(state) {
  const layout2 = createBufferedLayoutState(state);
    SET_LAYOUT(
      {
        rightColumn: layout2.rightColumn,
        showSideBar: layout2.showSideBar,
        showTabBar: layout2.showTabBar
      },
      { scheduleBufferUpdate: false }
    );
}
function OPEN_PROJECT(pathname) {
    const layout2 = {
      rightColumn: "files",
      showSideBar: true,
      showTabBar: true
    };
}
function LISTEN_FOR_BOOTSTRAP_WINDOW() {
        layoutStore.SET_LAYOUT({
          rightColumn: "files",
          showSideBar: !!sideBarVisibility2,
          showTabBar: !!tabBarVisibility2
        });
}
function editorSetup() {
    const {
      trimUnnecessaryCodeBlockEmptyLines: trimUnnecessaryCodeBlockEmptyLines2,
      editorFontFamily: editorFontFamily2,
      hideQuickInsertHint: hideQuickInsertHint2,
    } = storeToRefs(preferencesStore);
    return {
        style: normalizeStyle({
          lineHeight: unref(lineHeight2),
          fontSize: \`\${unref(fontSize2)}px\`,
          "font-family": unref(editorFontFamily2) ? \`\${unref(editorFontFamily2)}, \${unref(defaultFontFamily)}\` : \`\${unref(defaultFontFamily)}\`
        })
    };
}
function preferencesSetup() {
    const {
      fontSize: fontSize2,
      editorFontFamily: editorFontFamily2,
      lineHeight: lineHeight2,
      autoPairBracket: autoPairBracket2,
    } = storeToRefs(preferenceStore);
    return [
            createVNode(_sfc_main$m, {
              description: unref(t2)("preferences.editor.textEditor.fontFamily"),
              value: unref(editorFontFamily2),
              "on-change": (value) => onSelectChange("editorFontFamily", value)
            }, null, 8, ["description", "value", "on-change"]),
    ];
}
`

const mainFixture = `
const editorFontFamily = { "description": "Editor--editor font family", "type": "string", "pattern": "^[^\\\\s]+((-|\\\\s)*[^\\\\s])*$", "default": "Open Sans" };
const fontSize = { "description": "Editor--Font size in pixels", "type": "number", "default": 16 };
const schema = {
  language,
  editorFontFamily,
  fontSize,
  lineHeight,
};
function getBackground(theme) {
  switch (theme) {
      case "dark":
      return "#000";
  }
}
const menu = [
    {
      label: t("menu.theme.ayuLight"),
    }
];
function activate() {
      if (this._windowManager.windowCount === 0) {
  }
}
function ready() {
    const { _args: args2, _openFilesCache } = this;
}
`

const makeBundleFixture = (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-font-runtime-test-'))
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }))

  const rendererDir = path.join(fixtureRoot, 'out', 'renderer', 'assets')
  const mainDir = path.join(fixtureRoot, 'out', 'main')
  fs.mkdirSync(rendererDir, { recursive: true })
  fs.mkdirSync(mainDir, { recursive: true })
  fs.writeFileSync(path.join(rendererDir, 'index.js'), rendererFixture)
  fs.writeFileSync(path.join(mainDir, 'index.js'), mainFixture)
  return { fixtureRoot, rendererDir, mainDir }
}

test('ASAR patch adds independent title, heading, and body font preferences to MarkText runtime', (t) => {
  const { fixtureRoot, rendererDir, mainDir } = makeBundleFixture(t)

  execFileSync(process.execPath, [path.join(root, 'scripts', 'patch-asar-themes.mjs'), fixtureRoot])

  const renderer = fs.readFileSync(path.join(rendererDir, 'index.js'), 'utf8')
  const main = fs.readFileSync(path.join(mainDir, 'index.js'), 'utf8')

  for (const preference of ['editorTitleFontFamily', 'editorHeadingFontFamily', 'editorBodyFontFamily']) {
    assert.match(renderer, new RegExp(`const ${preference} =`), `${preference} must exist in the renderer schema`)
    assert.match(main, new RegExp(`const ${preference} =`), `${preference} must exist in the main schema`)
    assert.match(renderer, new RegExp(`onSelectChange\\("${preference}"`), `${preference} must be editable in Preferences`)
  }

  assert.match(renderer, /"--editor-title-font-family"/)
  assert.match(renderer, /"--editor-heading-font-family"/)
  assert.match(renderer, /"--editor-body-font-family"/)
  assert.match(renderer, /大标题字体 \/ Large title font/)
  assert.match(renderer, /小标题字体 \/ Heading font/)
  assert.match(renderer, /正文字体 \/ Body font/)

  execFileSync(process.execPath, [path.join(root, 'scripts', 'patch-asar-themes.mjs'), fixtureRoot])
  assert.equal(
    fs.readFileSync(path.join(rendererDir, 'index.js'), 'utf8').match(/Lens Design editor font style patch start/g)?.length,
    1,
    'the runtime patch must remain idempotent'
  )
})

test('Lens Design reads runtime font roles instead of relying on one inherited editor font', () => {
  const css = fs.readFileSync(path.join(root, 'themes', 'lens-design-marktext.css'), 'utf8')

  assert.match(css, /\.mu-container h1[^{}]*\{[^{}]*font-family:\s*var\(--editor-title-font-family,\s*var\(--reading-font-title\)\)/s)
  assert.match(css, /\.mu-container h2[^{}]*\{[^{}]*font-family:\s*var\(--editor-heading-font-family,\s*var\(--reading-font-heading\)\)/s)
  assert.match(css, /\.mu-container p[^{}]*\{[^{}]*font-family:\s*var\(--editor-body-font-family,\s*var\(--reading-font-body\)\)/s)
  assert.doesNotMatch(
    css,
    /(?:^|\n)\s*\.mu-paragraph\s*,[^{}]*\{[^{}]*font-family:\s*var\(--editor-body-font-family/s,
    'the body rule must not flatten Muya heading elements, which also carry mu-paragraph'
  )
})

test('theme installer persists distinct Chinese-safe defaults for every reading role', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-font-prefs-test-'))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))

  const appSupport = path.join(home, 'Library', 'Application Support', 'marktext')
  fs.mkdirSync(appSupport, { recursive: true })
  fs.writeFileSync(path.join(appSupport, 'preferences.json'), '{}\n')

  execFileSync(process.execPath, [path.join(root, 'scripts', 'install-theme.mjs')], {
    env: { ...process.env, HOME: home }
  })

  const prefs = JSON.parse(fs.readFileSync(path.join(appSupport, 'preferences.json'), 'utf8'))
  assert.equal(prefs.editorTitleFontFamily, 'Cormorant Garamond')
  assert.equal(prefs.editorHeadingFontFamily, 'Spectral')
  assert.equal(prefs.editorBodyFontFamily, 'Noto Sans SC')
  assert.notEqual(prefs.editorTitleFontFamily, prefs.editorHeadingFontFamily)
  assert.notEqual(prefs.editorHeadingFontFamily, prefs.editorBodyFontFamily)
})

test('runtime font variables keep the Lens Design CJK fallback stack available', (t) => {
  const { fixtureRoot, rendererDir } = makeBundleFixture(t)

  execFileSync(process.execPath, [path.join(root, 'scripts', 'patch-asar-themes.mjs'), fixtureRoot])

  const renderer = fs.readFileSync(path.join(rendererDir, 'index.js'), 'utf8')

  assert.match(renderer, /const editorTitleFontFamily = .*default": "Cormorant Garamond"/)
  assert.match(renderer, /const editorHeadingFontFamily = .*default": "Spectral"/)
  assert.match(renderer, /const editorBodyFontFamily = .*default": "Noto Sans SC"/)
  assert.match(renderer, /"--editor-title-font-family": unref\(editorTitleFontFamily2\) \? `\$\{unref\(editorTitleFontFamily2\)\}` : `var\(--reading-font-title\)`/)
  assert.match(renderer, /"--editor-heading-font-family": unref\(editorHeadingFontFamily2\) \? `\$\{unref\(editorHeadingFontFamily2\)\}` : `var\(--reading-font-heading\)`/)
  assert.match(renderer, /"--editor-body-font-family": unref\(editorBodyFontFamily2\) \? `\$\{unref\(editorBodyFontFamily2\)\}` : `var\(--reading-font-body\)`/)
})
