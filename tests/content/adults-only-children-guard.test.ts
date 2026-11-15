import fs from 'node:fs';
import path from 'node:path';

/**
 * Content guard: an invitation whose text says «solo adultos» must not offer child places in its
 * demo pass (rsvp.demoMaxChildren must be 0 or absent).
 */
const ROOT = path.resolve(process.cwd(), 'src/invitations');
const ADULTS_ONLY = /solo(?: para)? adultos/i;

function findContentFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return findContentFiles(full);
		return entry.name === 'content.json' ? [full] : [];
	});
}

function collectStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
	else if (value && typeof value === 'object') {
		Object.values(value).forEach((item) => collectStrings(item, out));
	}
	return out;
}

// Slugs whose «solo adultos» text is known to contradict their demo pass. Keep it empty.
const KNOWN_CONTRADICTIONS = new Set<string>([]);

const entries = findContentFiles(ROOT).map((file) => ({
	slug: path.basename(path.dirname(file)),
	data: JSON.parse(fs.readFileSync(file, 'utf8')) as { rsvp?: { demoMaxChildren?: number } },
}));

describe('adults-only content never offers child places', () => {
	it('finds invitation content to guard', () => {
		expect(entries.length).toBeGreaterThan(0);
	});

	const sayAdultsOnly = entries.filter(({ data }) =>
		collectStrings(data).some((text) => ADULTS_ONLY.test(text)),
	);

	it('still finds at least one adults-only invitation', () => {
		expect(sayAdultsOnly.length).toBeGreaterThan(0);
	});

	for (const { slug, data } of sayAdultsOnly) {
		const run = KNOWN_CONTRADICTIONS.has(slug) ? it.failing : it;
		run(`${slug}: «solo adultos» text means demoMaxChildren is 0 or absent`, () => {
			expect(data.rsvp?.demoMaxChildren ?? 0).toBe(0);
		});
	}
});
