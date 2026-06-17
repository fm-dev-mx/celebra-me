import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const FIXTURE_ROOT = join(ROOT, 'tests/fixtures/graphify-operational');
const CLI_PATH = join(ROOT, 'scripts/cli.mjs');

import {
	validateGraphShape,
	validateAnalysisShape,
	classifyFileCategory,
	classifyRsvpDomainGroup,
	classifyCleanupSection,
	serializeStableJson,
	buildGraphIndexes,
	computeCommunitySummary,
	computeRiskHubs,
	computeCleanupReport,
	computeRsvpDomainReport,
} from '../../scripts/graphify-operational-views';

function generateInput(name: string) {
	return JSON.parse(readFileSync(join(FIXTURE_ROOT, name), 'utf8'));
}

const fixtureGraph = () => generateInput('graph.json') as Record<string, unknown>;
const fixtureAnalysis = () => generateInput('.graphify_analysis.json') as Record<string, unknown>;
const fixtureGraphPath = join(FIXTURE_ROOT, 'graph.json');

function generateFixtureReports() {
	const graph = fixtureGraph();
	const analysis = fixtureAnalysis();
	const indexes = buildGraphIndexes(graph, analysis);
	const options = { sourceGraphPath: fixtureGraphPath.replaceAll('\\', '/') };
	return {
		indexes,
		communitySummary: computeCommunitySummary(graph, analysis, indexes, options),
		riskHubs: computeRiskHubs(graph, indexes, options),
		cleanupReport: computeCleanupReport(graph, analysis, indexes, options),
		rsvpDomainReport: computeRsvpDomainReport(graph, analysis, indexes, options),
	};
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateGraphShape', () => {
	it('accepts a valid graph', () => {
		const graph = fixtureGraph();
		expect(() => validateGraphShape(graph)).not.toThrow();
	});

	it('rejects null input', () => {
		expect(() => validateGraphShape(null)).toThrow('graph must be an object.');
	});

	it('rejects missing nodes', () => {
		expect(() => validateGraphShape({ links: [] })).toThrow('graph.nodes must be an array.');
	});

	it('rejects missing links', () => {
		expect(() => validateGraphShape({ nodes: [] })).toThrow('graph.links must be an array.');
	});

	it('rejects a node without an id', () => {
		expect(() => validateGraphShape({ nodes: [{ label: 'foo' }], links: [] })).toThrow(
			'graph.nodes[0].id must be a non-empty string.',
		);
	});
});

describe('validateAnalysisShape', () => {
	it('accepts a valid analysis', () => {
		const analysis = fixtureAnalysis();
		expect(() => validateAnalysisShape(analysis)).not.toThrow();
	});

	it('rejects null input', () => {
		expect(() => validateAnalysisShape(null)).toThrow('analysis must be an object.');
	});

	it('rejects missing communities', () => {
		expect(() => validateAnalysisShape({ cohesion: {} })).toThrow(
			'analysis.communities must be an object.',
		);
	});

	it('rejects a non-array community entry', () => {
		expect(() =>
			validateAnalysisShape({ communities: { '1': 'not-an-array' }, cohesion: {} }),
		).toThrow('analysis.communities.1 must be an array.');
	});
});

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

describe('classifyFileCategory', () => {
	it('classifies src/ paths', () => {
		expect(classifyFileCategory('src/lib/entry.ts')).toBe('src');
	});

	it('classifies tests/ paths', () => {
		expect(classifyFileCategory('tests/unit/foo.test.ts')).toBe('tests');
	});

	it('classifies scripts/ paths', () => {
		expect(classifyFileCategory('scripts/tool.mjs')).toBe('scripts');
	});

	it('classifies supabase/ paths', () => {
		expect(classifyFileCategory('supabase/migrations/001.sql')).toBe('supabase');
	});

	it('classifies config root files', () => {
		expect(classifyFileCategory('package.json')).toBe('configRoot');
	});

	it('classifies unknown as other', () => {
		expect(classifyFileCategory('tools/custom.config')).toBe('other');
	});

	it('handles empty string', () => {
		expect(classifyFileCategory('')).toBe('other');
	});

	it('handles null', () => {
		expect(classifyFileCategory(null as unknown as string)).toBe('other');
	});

	it('handles Windows backslash paths', () => {
		expect(classifyFileCategory('src\\lib\\entry.ts')).toBe('src');
	});
});

describe('classifyRsvpDomainGroup', () => {
	it('classifies server RSVP files', () => {
		const result = classifyRsvpDomainGroup('src/lib/rsvp/services/rsvp-submission.service.ts');
		expect(result).toBe('serverRsvp');
	});

	it('classifies public invitation RSVP', () => {
		const result = classifyRsvpDomainGroup('src/components/invitation/RsvpSection.astro');
		expect(result).toBe('publicInvitationRsvp');
	});

	it('classifies client RSVP API', () => {
		const result = classifyRsvpDomainGroup('src/lib/client/rsvp-api.ts');
		expect(result).toBe('clientRsvpApi');
	});

	it('returns null for non-RSVP paths', () => {
		const result = classifyRsvpDomainGroup('src/lib/entry.ts');
		expect(result).toBeNull();
	});

	it('handles null', () => {
		expect(classifyRsvpDomainGroup(null as unknown as string)).toBeNull();
	});

	it('handles empty string', () => {
		expect(classifyRsvpDomainGroup('')).toBeNull();
	});

	it('is case-insensitive', () => {
		const result = classifyRsvpDomainGroup('src/LIB/RSVP/SERVICES/foo.ts');
		expect(result).toBe('serverRsvp');
	});
});

describe('classifyCleanupSection', () => {
	it('classifies isolated src file as high-confidence candidate', () => {
		const result = classifyCleanupSection({
			sourceFile: 'src/lib/isolated.ts',
			degree: 0,
			category: 'src',
		});
		expect(result).toBe('highConfidenceReviewCandidates');
	});

	it('classifies entrypoint as entrypointsOrRuntimeBoundaries', () => {
		const result = classifyCleanupSection({
			sourceFile: 'src/pages/[slug].astro',
			degree: 5,
			category: 'src',
		});
		expect(result).toBe('entrypointsOrRuntimeBoundaries');
	});

	it('classifies null sourceFile as lowConfidenceNoise', () => {
		const result = classifyCleanupSection({
			sourceFile: null,
			degree: 0,
			category: 'other',
		});
		expect(result).toBe('lowConfidenceNoise');
	});

	it('classifies test files as testsAndFixtures', () => {
		const result = classifyCleanupSection({
			sourceFile: 'tests/unit/foo.test.ts',
			degree: 1,
			category: 'tests',
		});
		expect(result).toBe('testsAndFixtures');
	});
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('serializeStableJson', () => {
	it('produces deterministic output with sorted keys', () => {
		const first = serializeStableJson({ b: 2, a: 1, c: { z: 9, y: 8 } });
		const second = serializeStableJson({ c: { y: 8, z: 9 }, a: 1, b: 2 });
		expect(first).toBe(second);
		expect(first).toContain('"a": 1');
		expect(first).toContain('"b": 2');
		expect(first).toContain('"c":');
	});

	it('does not sort arrays', () => {
		const result = serializeStableJson({ items: [3, 1, 2] });
		expect(JSON.parse(result).items).toEqual([3, 1, 2]);
	});
});

// ---------------------------------------------------------------------------
// Report computations (direct function calls, no CLI spawn)
// ---------------------------------------------------------------------------

describe('community summary', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('has correct top-level metadata', () => {
		expect(reports.communitySummary).toMatchObject({
			builtAtCommit: 'abc123',
			graphDirected: false,
			nodeCount: 26,
			linkCount: 14,
			graphCommunityCount: 20,
			analysisCommunityCount: 19,
			communityCountMismatch: true,
		});
		expect(reports.communitySummary).not.toHaveProperty('generatedAt');
	});

	it('computes community stats', () => {
		const communities = reports.communitySummary.communities as Array<Record<string, unknown>>;
		const communityOne = communities.find((c) => c.communityId === '1');
		expect(communityOne).toMatchObject({
			size: 2,
			internalEdgeCount: 1,
			externalEdgeCount: 3,
		});
	});

	it('renders community summary markdown', async () => {
		const { renderCommunitySummaryMarkdown } =
			await import('../../scripts/graphify-operational-views');
		const markdown = renderCommunitySummaryMarkdown(reports.communitySummary);
		expect(markdown).toContain('source/target metrics are orientation hints');
		expect(markdown).toContain('Community count mismatch');
	});
});

describe('risk hubs', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('splits hubs by file category', () => {
		const categories = reports.riskHubs.categories as Record<
			string,
			{ files: Array<Record<string, unknown>>; nodes: Array<Record<string, unknown>> }
		>;
		expect(new Set(Object.keys(categories))).toEqual(
			new Set(['src', 'tests', 'scripts', 'supabase', 'configRoot', 'other']),
		);
	});

	it('includes src/lib/entry.ts metrics', () => {
		const categories = reports.riskHubs.categories as Record<string, unknown>;
		const srcEntry = (categories.src as { files: Array<Record<string, unknown>> }).files.find(
			(file) => file.sourceFile === 'src/lib/entry.ts',
		);
		expect(srcEntry).toMatchObject({
			degree: 2,
			sourceOrientedCount: 1,
			targetOrientedCount: 1,
			crossCommunityEdgeCount: 1,
			symbolCount: 1,
		});
	});

	it('treats missing source_file as other category', () => {
		const categories = reports.riskHubs.categories as Record<string, unknown>;
		const missingSourceNode = (
			categories.other as { nodes: Array<Record<string, unknown>> }
		).nodes.find((node) => node.id === 'missing_source');
		expect(missingSourceNode).toMatchObject({
			sourceFile: null,
			degree: 1,
			sourceOrientedCount: 1,
			targetOrientedCount: 0,
			crossCommunityEdgeCount: 1,
		});
	});

	it('renders risk hubs markdown', async () => {
		const { renderRiskHubsMarkdown } = await import('../../scripts/graphify-operational-views');
		const markdown = renderRiskHubsMarkdown(reports.riskHubs);
		expect(markdown).toContain('sourceOrientedCount');
		expect(markdown).toContain('## tests');
	});
});

describe('cleanup report', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('reports cleanup sections by category', () => {
		const cleanup = reports.cleanupReport;
		const isolatedNodes = cleanup.isolatedNodes as {
			byCategory: Record<string, Array<Record<string, unknown>>>;
		};
		const isolatedFiles = cleanup.isolatedFiles as {
			byCategory: Record<string, Array<Record<string, unknown>>>;
		};
		const sourceOnly = cleanup.filesWithSourceOrientedEdgesOnly as {
			byCategory: Record<string, Array<Record<string, unknown>>>;
		};
		const noTarget = cleanup.filesWithNoTargetOrientedEdges as {
			byCategory: Record<string, Array<Record<string, unknown>>>;
		};
		const singleNodeCommunities = cleanup.singleNodeCommunities as unknown[];
		const sections = cleanup.sections as Record<string, Array<Record<string, unknown>>>;

		expect(singleNodeCommunities).toHaveLength(14);
		expect(isolatedNodes.byCategory.src).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'isolated', sourceFile: 'src/lib/isolated.ts' }),
			]),
		);
		expect(sourceOnly.byCategory.tests).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'tests/unit/entry.test.ts' }),
			]),
		);
		expect(noTarget.byCategory.scripts).toEqual(
			expect.arrayContaining([expect.objectContaining({ sourceFile: 'scripts/tool.mjs' })]),
		);
		expect(isolatedFiles.byCategory.src).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'src/lib/isolated.ts' }),
			]),
		);
		expect(sections.highConfidenceReviewCandidates).toEqual([
			expect.objectContaining({ sourceFile: 'src/lib/isolated.ts' }),
		]);
		expect(sections.entrypointsOrRuntimeBoundaries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'src/pages/[eventType]/[slug].astro' }),
				expect.objectContaining({
					sourceFile: 'src/pages/api/invitacion/[inviteId]/location.ts',
				}),
			]),
		);
		expect(sections.testsAndFixtures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'tests/e2e/flow.spec.ts' }),
				expect.objectContaining({ sourceFile: 'tests/unit/entry.test.ts' }),
			]),
		);
		expect(sections.migrationsAndSql).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'supabase/migrations/001.sql' }),
				expect.objectContaining({
					sourceFile: 'scripts/manual/production-patches/20260601000000_patch.sql',
				}),
				expect.objectContaining({ sourceFile: 'scripts/db/sql/bootstrap-admin.sql' }),
			]),
		);
		expect(sections.scriptsAndTooling).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'scripts/new-invitation.mjs' }),
				expect.objectContaining({ sourceFile: 'scripts/tool.mjs' }),
			]),
		);
		expect(sections.lowConfidenceNoise).toEqual(
			expect.arrayContaining([expect.objectContaining({ sourceFile: null })]),
		);
	});

	it('renders cleanup markdown', async () => {
		const { renderCleanupMarkdown } = await import('../../scripts/graphify-operational-views');
		const markdown = renderCleanupMarkdown(reports.cleanupReport);
		expect(markdown).toContain('high-confidence-review-candidates');
		expect(markdown).toContain('entrypoints-or-runtime-boundaries');
		expect(markdown).not.toContain('filesWithSourceOrientedEdgesOnly');
	});
});

describe('RSVP domain report', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('has correct top-level metadata', () => {
		const domain = reports.rsvpDomainReport;
		expect(domain).toMatchObject({
			builtAtCommit: 'abc123',
			graphDirected: false,
			sourceGraphPath: fixtureGraphPath.replaceAll('\\', '/'),
			domain: 'rsvp',
			nodeCount: 26,
			linkCount: 14,
			domainNodeCount: 12,
			domainFileCount: 11,
		});
		expect(domain).not.toHaveProperty('generatedAt');
	});

	it('groups RSVP files by domain layer', () => {
		const groups = reports.rsvpDomainReport.groups as Record<
			string,
			{ files: unknown[]; nodes: unknown[] }
		>;
		expect(groups.publicInvitationRsvp.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/components/invitation/RsvpSection.astro' }),
		]);
		expect(groups.rsvpHooks.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/hooks/useRsvpSubmission.ts' }),
		]);
		expect(groups.clientRsvpApi.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/lib/client/rsvp-api.ts' }),
		]);
		expect(groups.serverRsvp.files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceFile: 'src/lib/rsvp/services/rsvp-submission.service.ts',
				}),
				expect.objectContaining({
					sourceFile: 'src/lib/rsvp/repositories/guest.repository.ts',
				}),
			]),
		);
		expect(groups.invitationApiRoutes.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/pages/api/invitacion/[inviteId]/rsvp.ts' }),
		]);
		expect(groups.protectedLocation.files).toEqual([
			expect.objectContaining({
				sourceFile: 'src/pages/api/invitacion/[inviteId]/location.ts',
			}),
		]);
		expect(groups.calendarTime.files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceFile: 'src/components/invitation/AddToCalendarButton.tsx',
				}),
				expect.objectContaining({ sourceFile: 'src/lib/time/event-time.ts' }),
			]),
		);
		expect(groups.dashboardGuestRsvp.files).toEqual([
			expect.objectContaining({
				sourceFile: 'src/components/dashboard/guests/GuestDashboardApp.tsx',
			}),
		]);
		expect(groups.rsvpTests.files).toEqual([
			expect.objectContaining({ sourceFile: 'tests/api/rsvp-v2.endpoints.test.ts' }),
		]);
	});

	it('ranks top risk files', () => {
		const topRiskFiles = reports.rsvpDomainReport.topRiskFiles as Array<
			Record<string, unknown>
		>;
		expect(topRiskFiles[0]).toMatchObject({
			sourceFile: 'src/lib/rsvp/services/rsvp-submission.service.ts',
			group: 'serverRsvp',
		});
	});

	it('identifies cross-boundary links', () => {
		const crossBoundaryLinks = reports.rsvpDomainReport.topCrossBoundaryLinks as Array<
			Record<string, unknown>
		>;
		expect(crossBoundaryLinks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceFile: 'src/pages/api/invitacion/[inviteId]/rsvp.ts',
					targetFile: 'src/lib/rsvp/services/rsvp-submission.service.ts',
					sourceGroup: 'invitationApiRoutes',
					targetGroup: 'serverRsvp',
				}),
				expect.objectContaining({
					sourceFile: 'src/lib/rsvp/services/rsvp-submission.service.ts',
					targetFile: 'src/lib/helper.ts',
					targetGroup: null,
				}),
			]),
		);
	});

	it('reports tests touching RSVP', () => {
		const tests = reports.rsvpDomainReport.testsTouchingRsvp as Array<Record<string, unknown>>;
		expect(tests).toEqual([
			expect.objectContaining({ sourceFile: 'tests/api/rsvp-v2.endpoints.test.ts' }),
		]);
	});

	it('renders RSVP domain markdown', async () => {
		const { renderRsvpDomainMarkdown } =
			await import('../../scripts/graphify-operational-views');
		const markdown = renderRsvpDomainMarkdown(reports.rsvpDomainReport);
		expect(markdown).toContain('# Graphify Domain RSVP');
		expect(markdown).toContain('## practical-change-checklist');
		expect(markdown).toContain('RSVP submitted state');
		expect(markdown).toContain('Response editing / change my response');
		expect(markdown).toContain('src/pages/api/invitacion/[inviteId]/location.ts');
		expect(markdown).toContain('Add-to-calendar / time');
	});
});

// ---------------------------------------------------------------------------
// CLI integration — one spawn to verify the full pipeline end-to-end
// ---------------------------------------------------------------------------

describe('CLI integration', () => {
	it('generates all 9 output files deterministically', () => {
		const outputRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-'));

		try {
			runCommand(
				'node',
				[
					CLI_PATH,
					'graphify-views',
					'--graph',
					join(FIXTURE_ROOT, 'graph.json'),
					'--analysis',
					join(FIXTURE_ROOT, '.graphify_analysis.json'),
					'--out',
					outputRoot,
				],
				{ cwd: ROOT },
			);

			const files = [
				'README.md',
				'community-summary.json',
				'community-summary.md',
				'risk-hubs.json',
				'risk-hubs.md',
				'cleanup-report.json',
				'cleanup-report.md',
				'domain-rsvp.json',
				'domain-rsvp.md',
			];
			for (const file of files) {
				expect(readFileSync(join(outputRoot, file), 'utf8')).toBeTruthy();
			}

			const firstRisk = readFileSync(join(outputRoot, 'risk-hubs.json'), 'utf8');
			runCommand(
				'node',
				[
					CLI_PATH,
					'graphify-views',
					'--graph',
					join(FIXTURE_ROOT, 'graph.json'),
					'--analysis',
					join(FIXTURE_ROOT, '.graphify_analysis.json'),
					'--out',
					outputRoot,
				],
				{ cwd: ROOT },
			);
			const secondRisk = readFileSync(join(outputRoot, 'risk-hubs.json'), 'utf8');

			expect(secondRisk).toBe(firstRisk);
			expect(secondRisk).not.toContain('generatedAt');
		} finally {
			rmSync(outputRoot, { recursive: true, force: true });
		}
	});
});
