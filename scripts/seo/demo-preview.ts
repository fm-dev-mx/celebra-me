import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEMO_PREVIEW_HEIGHT, DEMO_PREVIEW_WIDTH } from '../../src/lib/seo/demo-metadata';

interface DemoPreviewComposition {
	sourceKey?: string;
	/** Position within the available crop travel, from top (0) to bottom (1). */
	verticalPosition: number;
}

// Social crops are independent of the hero's viewport and never change client invitations.
const compositions: Record<string, DemoPreviewComposition> = {
	'demo-bautizo-angelic-presence': { verticalPosition: 0.4 },
	'demo-brisa': { sourceKey: 'interlude02', verticalPosition: 0.5 },
	'demo-cumple-luxury-hacienda': { verticalPosition: 0.2 },
	'demo-primera-comunion-angelic-presence': { verticalPosition: 0.6 },
	'demo-xv-celestial-blue': { sourceKey: 'heroDesktop', verticalPosition: 0.5 },
	'demo-xv-editorial': { verticalPosition: 0.45 },
	'demo-xv-enchanted-rose': { sourceKey: 'heroDesktop', verticalPosition: 0.5 },
};

export function getDemoPreviewComposition(slug: string): DemoPreviewComposition {
	return compositions[slug] ?? { verticalPosition: 0.5 };
}

/** Resolve a demo-only social source, falling back to its sharing image or hero. */
export async function resolveDemoPreviewSource(slug: string): Promise<string> {
	const folder = path.resolve('src/invitations/demos', slug);
	const content = JSON.parse(await readFile(path.join(folder, 'content.json'), 'utf8')) as {
		sharing?: { ogImage?: unknown };
		hero: { backgroundImage: unknown };
	};
	const key =
		getDemoPreviewComposition(slug).sourceKey ??
		content.sharing?.ogImage ??
		content.hero.backgroundImage;
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

/** Fill the social card with a reviewed crop, including when the source needs enlargement. */
export async function renderDemoPreview(
	source: string | Buffer,
	{ verticalPosition = 0.5 }: Partial<DemoPreviewComposition> = {},
): Promise<Buffer> {
	if (!Number.isFinite(verticalPosition) || verticalPosition < 0 || verticalPosition > 1) {
		throw new Error('Demo preview vertical position must be between 0 and 1');
	}
	const { data, info } = await sharp(source).rotate().raw().toBuffer({ resolveWithObject: true });
	const ratio = DEMO_PREVIEW_WIDTH / DEMO_PREVIEW_HEIGHT;
	const width = Math.min(info.width, Math.round(info.height * ratio));
	const height = Math.min(info.height, Math.round(info.width / ratio));
	return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
		.extract({
			left: Math.round((info.width - width) / 2),
			top: Math.round((info.height - height) * verticalPosition),
			width,
			height,
		})
		.resize(DEMO_PREVIEW_WIDTH, DEMO_PREVIEW_HEIGHT, { fit: 'cover' })
		.jpeg({ quality: 85 })
		.toBuffer();
}
