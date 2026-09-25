/**
 * Small colour moves, done in HSL.
 *
 * The park's palettes are written as hex, which is the right thing to read in
 * a file but the wrong thing to do arithmetic on: darkening #2d7a2f by eye
 * means guessing three numbers at once. These convert, move one axis, and
 * convert back.
 */

const clamp01 = (value) => Math.min(1, Math.max(0, value))

/**
 * @param {string} hex - '#rrggbb'
 * @returns {{ h: number, s: number, l: number }} h in turns, s and l in 0..1
 */
export function hexToHsl(hex) {
  const value = parseInt(hex.replace('#', ''), 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) return { h: 0, s: 0, l: lightness }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4

  return { h: ((hue / 6) + 1) % 1, s: saturation, l: lightness }
}

/**
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {string} '#rrggbb'
 */
export function hslToHex({ h, s, l }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const sector = (((h % 1) + 1) % 1) * 6
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const match = l - chroma / 2

  let rgb
  if (sector < 1) rgb = [chroma, second, 0]
  else if (sector < 2) rgb = [second, chroma, 0]
  else if (sector < 3) rgb = [0, chroma, second]
  else if (sector < 4) rgb = [0, second, chroma]
  else if (sector < 5) rgb = [second, 0, chroma]
  else rgb = [chroma, 0, second]

  return `#${rgb
    .map((channel) => Math.round(clamp01(channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}



/**
 * Down and richer: the same colour, in shadow.
 *
 * Used where something green has to sit on something else green and still be
 * seen, like a leaf lying on the grass it grew out of.
 *
 * @param {string} hex
 * @param {number} [amount=0.3]
 * @returns {string}
 */
export function deepen(hex, amount = 0.3) {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex({ h, s: Math.min(1, s * (1 + amount * 0.6)), l: l * (1 - amount) })
}
