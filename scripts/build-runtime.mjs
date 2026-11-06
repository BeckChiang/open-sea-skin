#!/usr/bin/env node
// Local fork build step: copy authored sources in shared/ into the served bundle
// directory native-dist/.
//
// Why a plain copy is a faithful build here:
//   In upstream 1.2.7 the installed native-dist/ocean.js and native-dist/styles.css
//   are byte-identical to the repository files shared/ocean.js and shared/styles.css
//   (git blob ids 17683a73e8d41a962b476159852638f177b0b6c9 and
//   4e63db9d555731f2d459843da8409724153cb3bb), so upstream's runtime build
//   performs no transform on these two files other than copying them.
//
// Usage:
//   node scripts/build-runtime.mjs           # write native-dist/*
//   node scripts/build-runtime.mjs --check   # exit 1 when generated files drift
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const COPIES = [
  ['shared/ocean.js', 'native-dist/ocean.js'],
  ['shared/styles.css', 'native-dist/styles.css'],
  // Optional helper modules: copied when present, never required.
  ['shared/solar.js', 'native-dist/solar.js'],
  ['shared/sky.js', 'native-dist/sky.js'],
  ['shared/sky-astro.js', 'native-dist/sky-astro.js'],
  ['shared/stars-data.js', 'native-dist/stars-data.js'],
  ['shared/stars-catalog.js', 'native-dist/stars-catalog.js'],
]

let drifted = false
for (const [from, to] of COPIES) {
  let source
  try {
    source = await readFile(join(root, from))
  } catch (error) {
    const optional = ['shared/solar.js', 'shared/sky.js', 'shared/sky-astro.js', 'shared/stars-data.js', 'shared/stars-catalog.js'].includes(from)
    if (error?.code === 'ENOENT' && optional) continue
    throw error
  }
  let current = null
  try {
    current = await readFile(join(root, to))
  } catch {
    current = null
  }
  if (current && current.equals(source)) {
    console.log(`ok      ${to}`)
    continue
  }
  drifted = true
  if (check) {
    console.error(`drift   ${to} (run: node scripts/build-runtime.mjs)`)
    continue
  }
  await writeFile(join(root, to), source)
  console.log(`wrote   ${to} (${source.byteLength} bytes)`)
}

if (check && drifted) process.exit(1)
