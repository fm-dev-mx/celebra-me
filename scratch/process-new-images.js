import sharp from 'sharp';
import path from 'path';

const ORIGINALS_DIR =
	'C:/Users/fmdevmx/OneDrive/Documentos/Projects/celebra-me/Clientes/XV America Johana/Fotos';
const TARGET_DIR = 'src/assets/images/events/xv-america-johana';

async function processImages() {
	console.info('Processing America Johana new photos...');

	const tasks = [
		{
			src: 'DSC03559.JPG',
			dest: 'gallery-01.webp',
		},
		{
			src: 'DSC03775.JPG',
			dest: 'gallery-02.webp',
		},
	];

	for (const task of tasks) {
		const srcPath = path.join(ORIGINALS_DIR, task.src);
		const destPath = path.join(TARGET_DIR, task.dest);

		console.info(`Processing: ${srcPath} -> ${destPath}`);
		await sharp(srcPath)
			.rotate() // Auto-rotates using EXIF orientation tag
			.resize(1400, 1750, {
				fit: 'cover',
				position: 'centre',
			})
			.webp({ quality: 80 })
			.toFile(destPath);
		console.info(`Saved ${task.dest}`);
	}

	console.info('Done processing!');
}

processImages().catch(console.error);
