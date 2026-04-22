import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'node_modules', '@meteocons', 'svg-static', 'line')
const dest = path.join(root, 'public', 'weather-icons', 'line')

if (!fs.existsSync(src)) {
  console.error(
    'copy-weather-icons: missing folder',
    src,
    '— run npm install so @meteocons/svg-static is present.'
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log('Copied Meteocons line SVGs to public/weather-icons/line')
