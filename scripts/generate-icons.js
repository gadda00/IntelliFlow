// Generate PWA icons from the SVG logo
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgBuffer = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo.svg'));

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(__dirname, '..', 'public', 'icon-192.png'));
  console.log('✓ icon-192.png');
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
  console.log('✓ icon-512.png');

  const background = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 10, g: 15, b: 13, alpha: 1 } },
  }).png().toBuffer();
  const logoResized = await sharp(svgBuffer).resize(380, 380).png().toBuffer();
  await sharp(background)
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png');

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(__dirname, '..', 'public', 'favicon-32.png'));
  console.log('✓ favicon-32.png');

  const ogBackground = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 10, g: 15, b: 13, alpha: 1 } },
  }).png().toBuffer();
  const ogLogo = await sharp(svgBuffer).resize(280, 280).png().toBuffer();
  await sharp(ogBackground)
    .composite([{ input: ogLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'og-image.png'));
  console.log('✓ og-image.png');
}

generate().catch(console.error);
