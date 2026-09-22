import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
// @bybas/weather-icons ships the animated set. @meteocons/svg-static, which
// this used to read, is the same artwork with the SMIL stripped out, so the
// icons arrived on screen frozen. That package no longer even ships a `line`
// folder, so postinstall was exiting 1 on a fresh install and leaving the app
// with no icons at all: public/weather-icons is gitignored, so a clone had
// nothing to fall back on.
const src = path.join(root, 'node_modules', '@bybas', 'weather-icons', 'production', 'line', 'all')
const dest = path.join(root, 'public', 'weather-icons', 'line')

if (!fs.existsSync(src)) {
  console.error(
    'copy-weather-icons: missing folder',
    src,
    'run npm install so @bybas/weather-icons is present.'
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log('Copied animated weather icons to public/weather-icons/line')
