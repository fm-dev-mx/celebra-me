import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LocalRenderCorpusEntry } from './registry.ts';
import type { LocalRenderCorpusFixture } from './fixture-types.ts';

function fixturesDir(): string {
	return resolve(process.cwd(), 'scripts/provision/local-render-corpus/fixtures');
}

export function loadLegacyCorpusFixture(entry: LocalRenderCorpusEntry): LocalRenderCorpusFixture {
	if (entry.sourceStrategy !== 'sanitized_fixture' || !entry.fixtureFile) {
		throw new Error(`Entry ${entry.slug} is not a sanitized fixture corpus entry.`);
	}
	const path = resolve(fixturesDir(), entry.fixtureFile);
	const raw = JSON.parse(readFileSync(path, 'utf8')) as LocalRenderCorpusFixture;
	if (raw.schemaVersion !== 1) {
		throw new Error(
			`Unsupported fixture schemaVersion for ${entry.slug}: ${raw.schemaVersion}`,
		);
	}
	if (raw.slug !== entry.slug) {
		throw new Error(`Fixture slug mismatch: file=${raw.slug} corpus=${entry.slug}`);
	}
	if (raw.eventType !== entry.eventType) {
		throw new Error(`Fixture eventType mismatch for ${entry.slug}`);
	}
	if (!raw.publishedContent || typeof raw.publishedContent !== 'object') {
		throw new Error(`Fixture ${entry.slug} is missing publishedContent.`);
	}
	return raw;
}
