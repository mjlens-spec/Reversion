#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [sourceArg, outputArg] = process.argv.slice(2)
if (!sourceArg || !outputArg) {
  throw new Error('Usage: generate-macos-icon.mjs <1024px-source.png> <output.icns>')
}

const source = path.resolve(sourceArg)
const output = path.resolve(outputArg)
const metadata = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', source], { encoding: 'utf8' })
if (!/pixelWidth:\s*1024/.test(metadata) || !/pixelHeight:\s*1024/.test(metadata) || !/format:\s*png/i.test(metadata)) {
  throw new Error(`The controlled App Icon source must be a 1024 x 1024 PNG:\n${metadata}`)
}

// Use the repository's established iconset layout and ICNS packer. macOS 26's
// iconutil rejects even the existing production iconset, while make-icns.mjs
// produces the canonical PNG-backed slots consumed correctly by Finder/Dock.
const iconsetEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'reversion-icon-'))
try {
  const iconset = path.join(temporaryDirectory, 'Reversion.iconset')
  fs.mkdirSync(iconset)
  for (const [name, size] of iconsetEntries) {
    const png = path.join(iconset, name)
    // Keep the approved source alpha channel in every ICNS slot. Flattening it
    // makes macOS render the otherwise rounded artwork as an opaque square.
    execFileSync('magick', [
      source,
      '-resize', `${size}x${size}!`,
      '-alpha', 'on',
      '-channel', 'A',
      '-fx', '(i==0&&j==0)||(i==w-1&&j==0)||(i==0&&j==h-1)||(i==w-1&&j==h-1)?0:u',
      '+channel',
      '-depth', '8',
      '-define', 'png:color-type=6',
      png
    ], { stdio: 'ignore' })
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  execFileSync(process.execPath, [path.join(scriptDirectory, 'make-icns.mjs'), iconset, output], { stdio: 'ignore' })
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}

const result = fs.readFileSync(output)
if (result.subarray(0, 4).toString('ascii') !== 'icns' || result.readUInt32BE(4) !== result.length) {
  throw new Error(`Generated ICNS failed its container integrity check: ${output}`)
}

process.stdout.write(`${output}\n`)
