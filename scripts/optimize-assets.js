
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve('src/assets/images');
const DEMO_XV_DIR = path.join(ASSETS_DIR, 'events/demo-xv');

// Map original files to new destination names in demo-xv folder
const ASSET_MAPPING = [
  { src: 'hero/lucia-portrait.png', dest: 'hero.webp' },
  { src: 'about/lucia-family.png', dest: 'family.webp' }, // Mapping family to family generic slot
  { src: 'about/lucia-family.png', dest: 'portrait.webp' }, // Also mapping to portrait for now as per plan
  { src: 'gallery/lucia-thank-you.png', dest: 'signature.webp' }, // Mapping thank you image to signature slot for now
  // Jardin image not found in originals, will keep placeholder or copy one
  { src: 'events/cumple-60-gerardo/jardin.webp', dest: 'jardin.webp' },

  // Gallery
  { src: 'gallery/lucia-gallery-1.png', dest: 'gallery-01.webp' },
  { src: 'gallery/lucia-gallery-2.png', dest: 'gallery-02.webp' },
  { src: 'gallery/lucia-gallery-3.png', dest: 'gallery-03.webp' },
  { src: 'gallery/lucia-gallery-4.png', dest: 'gallery-04.webp' },
  { src: 'gallery/lucia-gallery-5.png', dest: 'gallery-05.webp' },
  { src: 'gallery/lucia-gallery-6.png', dest: 'gallery-06.webp' },
  { src: 'gallery/lucia-gallery-7.png', dest: 'gallery-07.webp' },
  { src: 'gallery/lucia-gallery-8.png', dest: 'gallery-08.webp' },
  { src: 'gallery/lucia-gallery-9.png', dest: 'gallery-09.webp' },
  { src: 'gallery/lucia-gallery-10.png', dest: 'gallery-10.webp' },
  { src: 'gallery/lucia-gallery-11.png', dest: 'gallery-11.webp' },
  { src: 'gallery/lucia-gallery-12.png', dest: 'gallery-12.webp' },
];

async function optimize() {
  console.log('Starting optimization...');

  // Ensure target directory exists
  if (!fs.existsSync(DEMO_XV_DIR)) {
    fs.mkdirSync(DEMO_XV_DIR, { recursive: true });
  }

  for (const { src, dest } of ASSET_MAPPING) {
    const sourcePath = path.join(ASSETS_DIR, src);
    const destPath = path.join(DEMO_XV_DIR, dest);

    if (fs.existsSync(sourcePath)) {
      console.log(`Processing ${src} -> ${dest}`);
      try {
        // If source is already webp (like jardin), just copy it
        if (sourcePath.endsWith('.webp')) {
             fs.copyFileSync(sourcePath, destPath);
        } else {
            await sharp(sourcePath)
            .webp({ quality: 80 })
            .toFile(destPath);
        }
      } catch (error) {
        console.error(`Error processing ${src}:`, error);
      }
    } else {
      console.warn(`Source file not found: ${src}`);
    }
  }

  console.log('Optimization complete!');
}

optimize();
