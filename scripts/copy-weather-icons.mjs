import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
// production/line/all holds the animated Meteocons; @meteocons/svg-static ships
// the same artwork with the SMIL stripped out, which is why the icons used to
// sit perfectly still.
const src = path.join(root, 'node_modules', '@bybas', 'weather-icons', 'production', 'line', 'all')
const dest = path.join(root, 'public', 'weather-icons', 'line')

if (!fs.existsSync(src)) {
  console.error(
    'copy-weather-icons: missing folder',
    src,
    '— run npm install so @bybas/weather-icons is present.'
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log('Copied animated Meteocons line SVGs to public/weather-icons/line')
