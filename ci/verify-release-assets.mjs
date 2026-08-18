#!/usr/bin/env node

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [artifactDirArg, version] = process.argv.slice(2)
if (!artifactDirArg || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Usage: verify-release-assets.mjs <artifact-dir> <version>')
}

const artifactDir = path.resolve(artifactDirArg)
const sha = (algorithm, filePath, encoding = 'hex') => {
  const hash = crypto.createHash(algorithm)
  hash.update(fs.readFileSync(filePath))
  return hash.digest(encoding)
}
const file = (name) => {
  const filePath = path.join(artifactDir, name)
  assert.ok(fs.statSync(filePath).isFile(), `missing release asset: ${name}`)
  return filePath
}
const yamlScalar = (text, key) => {
  const match = text.match(new RegExp(`^${key}:\\s+(.+?)\\s*$`, 'm'))
  assert.ok(match, `missing YAML field: ${key}`)
  return match[1]
}
const yamlFileEntries = (text) => {
  const entries = []
  const pattern = /^\s+- url:\s+(.+?)\s*\n\s+sha512:\s+(.+?)\s*\n\s+size:\s+(\d+)(?:\s*\n\s+blockMapSize:\s+(\d+))?/gm
  for (const match of text.matchAll(pattern)) {
    entries.push({
      name: match[1],
      sha512: match[2],
      size: Number(match[3]),
      blockMapSize: match[4] ? Number(match[4]) : null
    })
  }
  assert.ok(entries.length > 0, 'manifest has no file entries')
  return entries
}
const validateManifestEntry = (entry) => {
  const asset = file(entry.name)
  assert.equal(fs.statSync(asset).size, entry.size, `${entry.name} size mismatch`)
  assert.equal(sha('sha512', asset, 'base64'), entry.sha512, `${entry.name} SHA-512 mismatch`)
}

const macNames = [
  `Reversion-${version}-arm64-mac.zip`,
  `Reversion-${version}-x64-mac.zip`
]
const macManifest = fs.readFileSync(file('latest-mac.yml'), 'utf8')
assert.equal(yamlScalar(macManifest, 'version'), version, 'latest-mac.yml version mismatch')
const macEntries = yamlFileEntries(macManifest)
assert.deepEqual(
  macEntries.map((entry) => entry.name).sort(),
  [...macNames].sort(),
  'latest-mac.yml must contain exactly the arm64 and x64 update ZIPs'
)
for (const entry of macEntries) validateManifestEntry(entry)
assert.equal(yamlScalar(macManifest, 'path'), macNames[0], 'latest-mac.yml path must prefer arm64')
assert.equal(
  yamlScalar(macManifest, 'sha512'),
  macEntries.find((entry) => entry.name === macNames[0]).sha512,
  'latest-mac.yml top-level SHA-512 mismatch'
)

const windowsName = `Reversion-${version}-windows-x64-setup.exe`
const windowsManifest = fs.readFileSync(file('latest.yml'), 'utf8')
assert.equal(yamlScalar(windowsManifest, 'version'), version, 'latest.yml version mismatch')
const windowsEntries = yamlFileEntries(windowsManifest)
assert.equal(windowsEntries.length, 1, 'latest.yml must contain exactly one Windows installer')
assert.equal(windowsEntries[0].name, windowsName, 'latest.yml Windows installer mismatch')
validateManifestEntry(windowsEntries[0])
assert.equal(yamlScalar(windowsManifest, 'path'), windowsName, 'latest.yml path mismatch')
assert.equal(yamlScalar(windowsManifest, 'sha512'), windowsEntries[0].sha512, 'latest.yml SHA-512 mismatch')
if (windowsEntries[0].blockMapSize !== null) {
  assert.equal(
    fs.statSync(file(`${windowsName}.blockmap`)).size,
    windowsEntries[0].blockMapSize,
    'Windows blockmap size mismatch'
  )
}

const sidecarNames = [
  windowsName,
  `Reversion-${version}-arm64.dmg`,
  `Reversion-${version}-x64.dmg`,
  ...macNames
]
for (const assetName of sidecarNames) {
  const sidecar = fs.readFileSync(file(`${assetName}.sha256`), 'utf8').trim()
  const match = sidecar.match(/^([0-9a-f]{64})\s{2}(.+)$/)
  assert.ok(match, `${assetName}.sha256 has an invalid format`)
  assert.equal(match[2], assetName, `${assetName}.sha256 names the wrong asset`)
  assert.equal(match[1], sha('sha256', file(assetName)), `${assetName} SHA-256 mismatch`)
}

const checksumAssets = [
  windowsName,
  `${windowsName}.blockmap`,
  'latest.yml',
  `Reversion-${version}-arm64.dmg`,
  `Reversion-${version}-x64.dmg`,
  ...macNames,
  'latest-mac.yml'
]
const checksumLines = fs.readFileSync(file('SHA256SUMS.txt'), 'utf8').trim().split('\n')
const checksumEntries = new Map(
  checksumLines.map((line) => {
    const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/)
    assert.ok(match, `invalid SHA256SUMS.txt line: ${line}`)
    return [match[2], match[1]]
  })
)
assert.deepEqual([...checksumEntries.keys()].sort(), [...checksumAssets].sort(), 'SHA256SUMS asset set mismatch')
for (const assetName of checksumAssets) {
  assert.equal(checksumEntries.get(assetName), sha('sha256', file(assetName)), `${assetName} summary SHA-256 mismatch`)
}

console.log(`Verified ${checksumAssets.length} primary release assets and ${sidecarNames.length} sidecars for ${version}.`)
