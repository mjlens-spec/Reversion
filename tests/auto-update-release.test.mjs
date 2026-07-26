import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'

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
`

const mainFixture = `
process.env.MARKTEXT_VERSION = "0.19.1";
process.env.MARKTEXT_VERSION_STRING = "v0.19.1";
let runningUpdate = false;
let win = null;
electronUpdater.autoUpdater.autoDownload = false;
electronUpdater.autoUpdater.on("error", (error) => {
  if (win) {
    const err = error;
    win.webContents.send("mt::UPDATE_ERROR", err.message);
  }
});
electronUpdater.autoUpdater.on("update-available", (_info) => {
  if (win) {
    win.webContents.send("mt::UPDATE_AVAILABLE", "Found an update");
  }
  runningUpdate = false;
});
electronUpdater.autoUpdater.on("update-not-available", (_info) => {
  if (win) {
    win.webContents.send("mt::UPDATE_NOT_AVAILABLE", "Current version is up-to-date.");
  }
  runningUpdate = false;
});
const checkUpdates = (browserWindow) => {
  if (!runningUpdate) {
    runningUpdate = true;
    win = browserWindow;
    electronUpdater.autoUpdater.checkForUpdates();
  }
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
const appController = new App(accessor, args);
appController.init();
`

test('Lens release feed points electron-updater at this GitHub repository', () => {
  const updateConfig = path.join(root, 'config', 'app-update.yml')
  assert.ok(fs.existsSync(updateConfig), 'config/app-update.yml must exist')
  const contents = fs.readFileSync(updateConfig, 'utf8')
  assert.match(contents, /^owner: mjlens-spec$/m)
  assert.match(contents, /^repo: Reversion$/m)
  assert.match(contents, /^provider: github$/m)
})

test('ASAR patch sets the Lens version and schedules one update check after the first window opens', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-update-test-'))
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }))

  const rendererDir = path.join(fixtureRoot, 'out', 'renderer', 'assets')
  const mainDir = path.join(fixtureRoot, 'out', 'main')
  fs.mkdirSync(rendererDir, { recursive: true })
  fs.mkdirSync(mainDir, { recursive: true })
  fs.writeFileSync(path.join(rendererDir, 'index.js'), rendererFixture)
  fs.writeFileSync(path.join(mainDir, 'index.js'), mainFixture)
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), '{"name":"marktext","version":"0.19.1"}\n')

  execFileSync(process.execPath, [path.join(root, 'scripts', 'patch-asar-themes.mjs'), fixtureRoot], {
    env: { ...process.env, LENS_RELEASE_VERSION: '1.0.0' }
  })

  const main = fs.readFileSync(path.join(mainDir, 'index.js'), 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'package.json'), 'utf8'))
  assert.match(main, /Lens automatic update check patch start/)
  assert.match(main, /electron\.app\.once\("browser-window-created"/)
  assert.match(main, /setTimeout\(\(\) => checkUpdates\(browserWindow, \{ silent: true \}\), 15_000\)/)
  assert.match(main, /if \(win && !lensAutomaticUpdateCheck\)/)
  assert.match(main, /lensAutomaticUpdateCheck = options\.silent === true/)
  assert.equal(main.match(/Lens automatic update check patch start/g)?.length, 1)
  assert.match(main, /process\.env\.MARKTEXT_VERSION = "1\.0\.0"/)
  assert.match(main, /process\.env\.MARKTEXT_VERSION_STRING = "v1\.0\.0"/)
  assert.equal(packageJson.version, '1.0.0')

  execFileSync(process.execPath, [path.join(root, 'scripts', 'patch-asar-themes.mjs'), fixtureRoot], {
    env: { ...process.env, LENS_RELEASE_VERSION: '1.0.0' }
  })
  assert.equal(
    fs.readFileSync(path.join(mainDir, 'index.js'), 'utf8').match(/Lens automatic update check patch start/g)?.length,
    1,
    'the update patch must remain idempotent'
  )
})

test('macOS update manifest uses the electron-updater latest-mac.yml contract', async () => {
  const modulePath = path.join(root, 'scripts', 'make-update-manifest.mjs')
  assert.ok(fs.existsSync(modulePath), 'scripts/make-update-manifest.mjs must exist')
  const { createMacUpdateManifest } = await import(pathToFileURL(modulePath))
  const manifest = createMacUpdateManifest({
    version: '1.0.0',
    fileName: 'Reversion-1.0.0-arm64-mac.zip',
    size: 123456,
    sha512: 'example-base64-digest',
    releaseDate: '2026-07-13T12:00:00.000Z'
  })

  assert.equal(manifest, [
    'version: 1.0.0',
    'files:',
    '  - url: Reversion-1.0.0-arm64-mac.zip',
    '    sha512: example-base64-digest',
    '    size: 123456',
    'path: Reversion-1.0.0-arm64-mac.zip',
    'sha512: example-base64-digest',
    'releaseDate: 2026-07-13T12:00:00.000Z',
    ''
  ].join('\n'))
  assert.throws(
    () => createMacUpdateManifest({ version: 'lens-1', fileName: 'a.zip', size: 1, sha512: 'x', releaseDate: 'now' }),
    /semantic version/
  )
})

test('release builder produces a signed app, updater ZIP, DMG, manifest, and checksums', () => {
  const scriptPath = path.join(root, 'scripts', 'build-release.sh')
  assert.ok(fs.existsSync(scriptPath), 'scripts/build-release.sh must exist')
  const script = fs.readFileSync(scriptPath, 'utf8')
  for (const requirement of [
    'latest-mac.yml',
    'ditto',
    'hdiutil create',
    'codesign --verify',
    'designated => identifier',
    'app-update.yml',
    'make-update-manifest.mjs',
    'themes/export',
    '*.lens-backup-*',
    '*.lens-*-backup-*',
    'shasum -a 256'
  ]) {
    assert.ok(script.includes(requirement), `release builder must include ${requirement}`)
  }
})
