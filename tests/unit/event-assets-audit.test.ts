import fs from 'node:fs';
import path from 'node:path';

interface AssetFinding {
	event: string;
	path: string;
}

function listEventAssetFindings(eventsRoot: string): AssetFinding[] {
	const findings: AssetFinding[] = [];
	const eventDirs = fs
		.readdirSync(eventsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory());

	for (const eventDir of eventDirs) {
		const fullDir = path.join(eventsRoot, eventDir.name);
		const indexPath = path.join(fullDir, 'index.ts');
		if (!fs.existsSync(indexPath)) continue;

		const indexSource = fs.readFileSync(indexPath, 'utf8');
		const importedAssets = new Set(
			Array.from(indexSource.matchAll(/'\.\/([^']+\.(?:png|jpe?g|webp|svg))'/g)).map(
				(match) => match[1],
			),
		);

		const imageFiles = fs
			.readdirSync(fullDir, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((name) => /\.(png|jpe?g|webp|svg)$/i.test(name));

		for (const imageFile of imageFiles) {
			if (!importedAssets.has(imageFile)) {
				findings.push({
					event: eventDir.name,
					path: path.join(fullDir, imageFile),
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
});
