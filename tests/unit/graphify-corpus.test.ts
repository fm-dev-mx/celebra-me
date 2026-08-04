import {
	assertCorpusContract,
	computeCorpusHealth,
	directionCaveat,
	FORBIDDEN_CORPUS_MARKERS,
	graphifyIgnoreSha256,
	normalizeRawGraphDirected,
	sourceFingerprint,
	validateGraphIntegrity,
} from '../../scripts/graphify-operational-views';
import { assertSourceStateFresh, currentHead } from '../../scripts/graphify/source-state';

const REQUIRED_ROUTE = 'src/pages/api/invitacion/public/[eventType]/[slug]/rsvp.ts';

describe('Graphify corpus contract', () => {
	it('keeps required routes, SQL nodes, and rejects forbidden sources', () => {
		const manifest = {
			[REQUIRED_ROUTE]: {},
			'supabase/migrations/001.sql': {},
			'node_modules/ignored.ts': {},
		};
		const graph = {
			nodes: [
				{ id: 'route', source_file: REQUIRED_ROUTE },
				{ id: 'sql', source_file: 'supabase/migrations/001.sql' },
			],
			links: [{ source: 'route', target: 'sql' }],
		};

		const health = computeCorpusHealth(manifest, graph);
		expect(health.sql.filesWithNodes).toBe(1);
		expect(health.missingRequiredGraphFiles).toEqual([]);
		expect(health.forbiddenManifestFiles).toEqual(['node_modules/ignored.ts']);
		expect(FORBIDDEN_CORPUS_MARKERS).toContain('tests/unit/graphify-corpus.test.ts');
		expect(() => assertCorpusContract(health)).toThrow('forbidden files in manifest');
	});

	it('fails closed when SQL is listed but produces no nodes', () => {
		const health = computeCorpusHealth(
			{ 'supabase/migrations/001.sql': {}, [REQUIRED_ROUTE]: {} },
			{ nodes: [{ id: 'route', source_file: REQUIRED_ROUTE }], links: [] },
		);
		expect(() => assertCorpusContract(health)).toThrow(
			'no SQL source files generated graph nodes',
		);
	});

	it('materializes external references and preserves directed endpoint uniqueness', () => {
		const normalized = normalizeRawGraphDirected({
			nodes: [{ id: 'a' }, { id: 'b' }],
			edges: [
				{ source: 'a', target: 'b', relation: 'imports' },
				{ source: 'a', target: 'b', relation: 're_exports' },
				{ source: 'a', target: 'ref_package', relation: 'references' },
			],
		});
		const integrity = validateGraphIntegrity(
			{ ...normalized, links: normalized.edges },
			{ directed: true },
		);
		expect(normalized.directed).toBe(true);
		expect(normalized.nodes).toHaveLength(3);
		expect(normalized.edges).toHaveLength(2);
		expect(integrity.duplicateDirectedPairs).toBe(0);
	});

	it('distinguishes directed and legacy direction caveats', () => {
		expect(directionCaveat({ graphDirected: true })).toContain(
			'directed dependency relationship',
		);
		expect(directionCaveat({ graphDirected: false })).toContain('orientation hints');
	});
});

describe('Graphify source fingerprints', () => {
	it('accepts the current snapshot and rejects a changed fingerprint', () => {
		const fingerprint = sourceFingerprint(process.cwd());
		const state = {
			schemaVersion: 2 as const,
			sourceHead: currentHead(process.cwd()),
			ignoreContractSha256: graphifyIgnoreSha256(process.cwd()),
			...fingerprint,
		};
		expect(() =>
			assertSourceStateFresh(state, process.cwd(), state.ignoreContractSha256),
		).not.toThrow();
		expect(() =>
			assertSourceStateFresh(
				{ ...state, trackedDiffHash: 'changed' },
				process.cwd(),
				state.ignoreContractSha256,
			),
		).toThrow('trackedDiffHash');
	});
});
