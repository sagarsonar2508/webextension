const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 128];
const assetsDir = path.join(__dirname, '..', 'assets');

// Create a simple WhatsApp-style icon
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#25D366"/>
  <path d="M64 28c-19.9 0-36 16.1-36 36 0 6.3 1.6 12.2 4.5 17.4L28 100l19.3-5c5 2.5 10.6 3.9 16.7 3.9 19.9 0 36-16.1 36-36S83.9 28 64 28zm0 66c-5.2 0-10.2-1.4-14.6-3.9l-1-.6-10.5 2.8 2.8-10.2-.7-1.1C37.4 76.4 36 71.3 36 66c0-15.4 12.6-28 28-28s28 12.6 28 28-12.6 28-28 28z" fill="white"/>
  <circle cx="90" cy="38" r="12" fill="#128C7E"/>
  <path d="M86 38h8M90 34v8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`;

async function generateIcons() {
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Generate icon.png (128x128) - this is the main icon Plasmo looks for
  await sharp(Buffer.from(svgIcon))
    .resize(128, 128)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  console.log('Generated icon.png (128x128)');

  // Generate additional sizes
  for (const size of sizes) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(assetsDir, `icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
