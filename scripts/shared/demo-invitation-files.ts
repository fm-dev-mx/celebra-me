import fs from 'node:fs';
import path from 'node:path';

/** Demo invitation folders, relative to the repository root: `<slug>/content.json` each. */
export const DEMO_INVITATIONS_DIR = 'src/invitations/demos';

export interface DemoInvitationFile {
	slug: string;
	eventType: string;
	contentPath: string;
	content: Record<string, unknown>;
}

/** Every demo folder with a `content.json`, sorted by slug. The folder name is the slug. */
export function listDemoInvitationFiles(
	root = path.resolve(process.cwd(), DEMO_INVITATIONS_DIR),
): DemoInvitationFile[] {
	if (!fs.existsSync(root)) throw new Error(`Demo directory is missing: ${root}`);
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(root, entry.name, 'content.json'))
		.filter((contentPath) => fs.existsSync(contentPath))
		.map((contentPath) => {
			let content: Record<string, unknown>;
			try {
				content = JSON.parse(fs.readFileSync(contentPath, 'utf8')) as Record<
					string,
					unknown
				>;
			} catch (error) {
				throw new Error(
					`Invalid demo content "${contentPath}": ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
			const slug = path.basename(path.dirname(contentPath));
			const eventType = typeof content.eventType === 'string' ? content.eventType : '';
			if (!eventType) throw new Error(`Demo ${contentPath} is missing eventType.`);
			return { slug, eventType, contentPath, content };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * The asset manifest of an asset slug: a demo folder's `assets.ts`, else the shared
 * `src/assets/images/events/<slug>/index.ts`. Returns null when neither exists.
 */
export function resolveEventAssetManifest(assetSlug: string, root = process.cwd()): string | null {
	const candidates = [
		path.join(root, DEMO_INVITATIONS_DIR, assetSlug, 'assets.ts'),
		path.join(root, 'src/assets/images/events', assetSlug, 'index.ts'),
	];
	return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** The folder holding an asset slug's image files, or null when it has no manifest. */
export function resolveEventAssetDirectory(assetSlug: string, root = process.cwd()): string | null {
	const manifest = resolveEventAssetManifest(assetSlug, root);
	if (!manifest) return null;
	const folder = path.dirname(manifest);
	return path.basename(manifest) === 'assets.ts' ? path.join(folder, 'assets') : folder;
}
