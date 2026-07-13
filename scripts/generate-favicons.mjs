import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../public/logo-icon.svg')
const svg = readFileSync(svgPath)

const sizes = [
  { file: 'favicon.png', size: 192 },
  { file: 'favicon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const { file, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(__dirname, '../public', file))
  console.log(`✓ public/${file} (${size}×${size})`)
}
