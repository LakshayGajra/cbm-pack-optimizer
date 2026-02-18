import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../public/icons')

// Ensure directory exists
fs.mkdirSync(publicDir, { recursive: true })

// SVG with gradient cube design
const svgImage = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3498DB;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#080C14;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#080C14" rx="50"/>
  <rect x="50" y="50" width="412" height="412" fill="url(#grad)" rx="40"/>

  <!-- Cube shape -->
  <g transform="translate(256, 256)">
    <!-- Front face -->
    <polygon points="-60,-60 60,-60 60,60 -60,60" fill="white" opacity="0.9"/>
    <!-- Top face -->
    <polygon points="-60,-60 0,-100 60,-60 0,-20" fill="white" opacity="0.7"/>
    <!-- Right face -->
    <polygon points="60,-60 100,-20 100,80 60,60" fill="white" opacity="0.8"/>
  </g>
</svg>
`

async function generateIcons() {
  try {
    console.log('Generating icons...')

    // Generate 512x512
    await sharp(Buffer.from(svgImage))
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'))
    console.log('✓ Generated icon-512x512.png')

    // Generate 192x192
    await sharp(Buffer.from(svgImage))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'))
    console.log('✓ Generated icon-192x192.png')

    console.log('✓ Icons generated successfully')
  } catch (error) {
    console.error('Error generating icons:', error)
    process.exit(1)
  }
}

generateIcons()
