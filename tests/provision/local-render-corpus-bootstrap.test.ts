import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
	assertLocalRenderCorpusIntegrity,
	listLocalRenderCorpus,
} from '../../scripts/provision/local-render-corpus/registry.ts';
import { resolveCorpusPublishedContent } from '../../scripts/provision/local-render-corpus/content.ts';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

describe('local render corpus contract', () => {
	it('derives every corpus entry from a schema-valid canonical definition', () => {
		assertLocalRenderCorpusIntegrity();
		for (const entry of listLocalRenderCorpus()) {
			const content = resolveCorpusPublishedContent(entry);
			expect(eventContentSchema.safeParse(content).success).toBe(true);
			expect(entry.classification).toBe('canonical');
			expect(entry.sourceStrategy).toBe('canonical_definition');
		}
	});

	it('rejects accidental demo/e2e/orphan membership in the corpus SSOT', () => {
		const slugs = listLocalRenderCorpus().map((entry) => entry.slug);
		for (const forbidden of ['e2e-preview-publication', 'alba-rosa-quinones']) {
			expect(slugs).not.toContain(forbidden);
		}
		expect(slugs.every((slug) => !slug.startsWith('demo-'))).toBe(true);
	});

	it('versions Romina managed source assets under the repository asset root', () => {
		const root = path.join(process.cwd(), 'src/assets/invitations/romina-rios-chaparro');
		expect(fs.existsSync(root)).toBe(true);
		const required = [
			'IMG_3263.jpeg',
			'IMG_3462.jpeg',
			'IMG_3405.jpeg',
			'IMG_3191.jpeg',
			'IMG_3201.jpeg',
			'IMG_3308.jpeg',
			'IMG_3324.jpeg',
			'IMG_3331.jpeg',
			'IMG_3386.jpeg',
			'IMG_3449.jpeg',
			'IMG_3442.jpeg',
		];
		for (const file of required) {
			expect(fs.existsSync(path.join(root, file))).toBe(true);
		}
	});
});

describe('local render corpus bootstrap safety', () => {
	it('documents Local-only bootstrap entrypoints without Preview/Production sync or DB clone', () => {
		const bootstrap = fs.readFileSync(
			path.join(process.cwd(), 'scripts/provision/local-render-corpus/bootstrap.ts'),
			'utf8',
		);
		const cli = fs.readFileSync(
			path.join(process.cwd(), 'scripts/provision/local-render-corpus/cli.ts'),
			'utf8',
		);
		expect(bootstrap).toContain("target !== 'persistent-local'");
		expect(bootstrap).toContain('LOCAL_RENDER_CORPUS_TARGET_REJECTED');
		expect(cli).toContain('Never targets Preview or Production');
		expect(cli).toContain('Never clones databases');
		expect(bootstrap).not.toContain('legacy');
		expect(bootstrap).not.toContain('db:preview:sync-invitations');
		expect(bootstrap).not.toContain('local-restore-from-dump');
	});
});
