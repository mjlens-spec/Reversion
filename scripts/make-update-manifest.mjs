#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const assertPlainYamlValue = (name, value) => {
  if (typeof value !== 'string' || !value || /[\r\n:#]/.test(value)) {
    throw new Error(`${name} must be a non-empty plain YAML value`)
  }
}

export const createMultiFileMacUpdateManifest = ({ version, files, releaseDate }) => {
  if (!semverPattern.test(version)) {
    throw new Error(`version must be a semantic version: ${version}`)
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('files must contain at least one update ZIP')
  }
  for (const [index, file] of files.entries()) {
    assertPlainYamlValue(`files[${index}].fileName`, file.fileName)
    assertPlainYamlValue(`files[${index}].sha512`, file.sha512)
    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      throw new Error(`files[${index}].size must be a positive integer: ${file.size}`)
    }
  }
  if (Number.isNaN(Date.parse(releaseDate))) {
    throw new Error(`releaseDate must be an ISO date: ${releaseDate}`)
  }

  const preferred = files.find((file) => file.fileName.includes('arm64')) ?? files[0]
  const lines = [`version: ${version}`, 'files:']
  for (const file of files) {
    lines.push(`  - url: ${file.fileName}`, `    sha512: ${file.sha512}`, `    size: ${file.size}`)
  }
  lines.push(
    `path: ${preferred.fileName}`,
    `sha512: ${preferred.sha512}`,
    `releaseDate: ${releaseDate}`,
    ''
  )
  return lines.join('\n')
}

export const createMacUpdateManifest = ({ version, fileName, size, sha512, releaseDate }) => {
  return createMultiFileMacUpdateManifest({
    version,
    files: [{ fileName, size, sha512 }],
    releaseDate
  })
}

export const sha512Base64 = (filePath) => {
  const hash = crypto.createHash('sha512')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('base64')
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = process.argv.slice(2)
  if (args[0] === '--multi') {
    const [, version, outputPath, ...zipPaths] = args
    if (!version || !outputPath || zipPaths.length === 0) {
      throw new Error('Usage: make-update-manifest.mjs --multi <version> <output> <zip> [zip...]')
    }
    const manifest = createMultiFileMacUpdateManifest({
      version,
      files: zipPaths.map((zipPath) => ({
        fileName: path.basename(zipPath),
        size: fs.statSync(zipPath).size,
        sha512: sha512Base64(zipPath)
      })),
      releaseDate: new Date().toISOString()
    })
    fs.writeFileSync(outputPath, manifest)
    console.log(`Created ${outputPath}`)
  } else {
    const [version, zipPath, outputPath, releaseDate = new Date().toISOString()] = args
    if (!version || !zipPath || !outputPath) {
      throw new Error('Usage: make-update-manifest.mjs <version> <zip> <output> [release-date]')
    }
    const manifest = createMacUpdateManifest({
      version,
      fileName: path.basename(zipPath),
      size: fs.statSync(zipPath).size,
      sha512: sha512Base64(zipPath),
      releaseDate
    })
    fs.writeFileSync(outputPath, manifest)
    console.log(`Created ${outputPath}`)
  }
}
