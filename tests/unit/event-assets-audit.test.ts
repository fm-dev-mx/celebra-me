import fs from 'node:fs';
import path from 'node:path';

interface AssetFinding {
	event: string;
	path: string;
}

/** `manifest` imports images from `imageDir`, both relative to each event folder. */
function listEventAssetFindings(
	eventsRoot: string,
	manifest = 'index.ts',
	imageDir = '.',
): AssetFinding[] {
	const findings: AssetFinding[] = [];
	const eventDirs = fs
		.readdirSync(eventsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory());

	for (const eventDir of eventDirs) {
		const fullDir = path.join(eventsRoot, eventDir.name);
		const indexPath = path.join(fullDir, manifest);
		if (!fs.existsSync(indexPath)) continue;

		const indexSource = fs.readFileSync(indexPath, 'utf8');
		const importedAssets = new Set(
			Array.from(indexSource.matchAll(/'\.\/([^']+\.(?:png|jpe?g|webp|svg))'/g)).map(
				(match) => path.posix.normalize(match[1]),
			),
		);
		const imageRoot = path.join(fullDir, imageDir);
		if (!fs.existsSync(imageRoot)) continue;

		const imageFiles = fs
			.readdirSync(imageRoot, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((name) => /\.(png|jpe?g|webp|svg)$/i.test(name));

		for (const imageFile of imageFiles) {
			if (!importedAssets.has(path.posix.join(imageDir, imageFile))) {
				findings.push({
					event: eventDir.name,
					path: path.join(imageRoot, imageFile),
				});
			}
		}
	}

	return findings;
}

describe('event asset modules', () => {
	it('import every local image file from each event index module', () => {
		const eventsRoot = path.resolve(process.cwd(), 'src/assets/images/events');

		expect(listEventAssetFindings(eventsRoot)).toEqual([]);
	});

	it('import every image in each demo folder from its assets.ts manifest', () => {
		const demosRoot = path.resolve(process.cwd(), 'src/invitations/demos');

		expect(listEventAssetFindings(demosRoot, 'assets.ts', 'assets')).toEqual([]);
	});
});
