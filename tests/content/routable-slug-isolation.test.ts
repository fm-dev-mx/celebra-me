import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const routableDirs = [
	path.join(projectRoot, 'src/content/events'),
	path.join(projectRoot, 'src/content/event-demos'),
];

type RoutableOwner = {
	eventType: string;
	relativePath: string;
};

function collectRoutableEntries(): Map<string, RoutableOwner> {
	const owners = new Map<string, RoutableOwner>();

	for (const dir of routableDirs) {
		if (!fs.existsSync(dir)) continue;

		const files = fs
			.readdirSync(dir, { recursive: true })
			.filter((file): file is string => typeof file === 'string')
			.filter((file) => file.endsWith('.json'));

		for (const file of files) {
			const absolutePath = path.join(dir, file);
			const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as {
				eventType?: string;
			};
			const slug = path.basename(file, '.json');

			if (owners.has(slug)) {
				const existing = owners.get(slug)!;
				throw new Error(
					`Duplicate routable slug "${slug}" found in ${existing.relativePath} (${existing.eventType}) and ${path.relative(projectRoot, absolutePath).replace(/\\/g, '/')} (${String(parsed.eventType || '').trim()}).`,
				);
			}

			owners.set(slug, {
				eventType: String(parsed.eventType || '').trim(),
				relativePath: path.relative(projectRoot, absolutePath).replace(/\\/g, '/'),
			});
		}
	}

	return owners;
}

describe('routable slug isolation', () => {
	it('keeps public event and demo slugs globally unique', () => {
		expect(() => collectRoutableEntries()).not.toThrow();
	});
});
