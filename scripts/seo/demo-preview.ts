import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEMO_PREVIEW_HEIGHT, DEMO_PREVIEW_WIDTH } from '../../src/lib/seo/demo-metadata';

/** Resolve only the demo's existing sharing image, falling back to its hero. */
export async function resolveDemoPreviewSource(slug: string): Promise<string> {
	const folder = path.resolve('src/invitations/demos', slug);
	const content = JSON.parse(await readFile(path.join(folder, 'content.json'), 'utf8')) as {
		sharing?: { ogImage?: unknown };
		hero: { backgroundImage: unknown };
	};
	const key = content.sharing?.ogImage ?? content.hero.backgroundImage;
	if (typeof key !== 'string' || !/^[a-zA-Z0-9]+$/.test(key)) {
		throw new Error(`Demo ${slug} needs a local image key for its preview`);
	}
	const manifest = await readFile(path.join(folder, 'assets.ts'), 'utf8');
	const imported = manifest.match(new RegExp(`import ${key} from ['"](.+?)['"]`))?.[1];
	if (!imported?.startsWith('./assets/')) {
		throw new Error(`No local preview source found for ${slug}: ${key}`);
	}
	return path.resolve(folder, imported);
}

/** Preserve the entire photograph, with neutral margins and no enlargement. */
export async function renderDemoPreview(source: string | Buffer): Promise<Buffer> {
	return sharp(source)
		.rotate()
		.resize(DEMO_PREVIEW_WIDTH, DEMO_PREVIEW_HEIGHT, {
			fit: 'contain',
			background: '#eeeae5',
			withoutEnlargement: true,
		})
		.jpeg({ quality: 85 })
		.toBuffer();
}
