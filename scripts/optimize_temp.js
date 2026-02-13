import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Using __dirname won't work in ESM without special handling, but process.cwd() is reliable for this purpose
const ROOT = process.cwd();
const inputPath = path.join(ROOT, 'src/assets/images/events/cumple-60-gerardo/family.jpeg');
const outputPath = path.join(ROOT, 'src/assets/images/events/cumple-60-gerardo/family.webp');

console.log(`Processing: ${inputPath} -> ${outputPath}`);

async function optimize() {
	try {
		if (!fs.existsSync(inputPath)) {
			console.error('Input file not found:', inputPath);
			process.exit(1);
		}

		console.log('Optimizing file...');

		const metadata = await sharp(inputPath).metadata();
		console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

		// Resize if excessively large (e.g. > 1200px width for a family photo in layout)
		// Family section usually takes 40-50% width on desktop, so 800-1000px width is plenty for retina.
		// Let's cap at 1200px width to be safe.
		let pipeline = sharp(inputPath);

		if (metadata.width > 1200) {
			console.log('Resizing to width 1200px...');
			pipeline = pipeline.resize({ width: 1200 });
		}

		await pipeline.webp({ quality: 80 }).toFile(outputPath);

		console.log('Success: Created optimized WebP image.');
	} catch (error) {
		console.error('Error optimizing image:', error);
		process.exit(1);
	}
}

optimize();
