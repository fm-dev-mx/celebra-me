import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
	classifyIntakePublishingGroup,
	classifyInvitationRenderingGroup,
	classifyThemeAssetGroup,
	classifyCleanupSection,
	serializeStableJson,
	buildGraphIndexes,
	computeCommunitySummary,
	computeRiskHubs,
	computeCleanupReport,
	computeRsvpDomainReport,
	computeIntakePublishingDomainReport,
	computeInvitationRenderingDomainReport,
	computeThemeAssetsDomainReport,
	renderCommunitySummaryMarkdown,
	renderRiskHubsMarkdown,
	renderCleanupMarkdown,
	renderRsvpDomainMarkdown,
	renderIntakePublishingDomainMarkdown,
	renderInvitationRenderingDomainMarkdown,
	renderThemeAssetsDomainMarkdown,
	requireFreshGraph,
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
		intakePublishingDomainReport: computeIntakePublishingDomainReport(
			graph,
			analysis,
			indexes,
			options,
		),
		invitationRenderingDomainReport: computeInvitationRenderingDomainReport(
			graph,
			analysis,
			indexes,
			options,
		),
		themeAssetsDomainReport: computeThemeAssetsDomainReport(graph, analysis, indexes, options),
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

describe('domain-specific classifiers', () => {
	it('classifies intake publishing files by operational boundary', () => {
		expect(
			classifyIntakePublishingGroup('src/lib/intake/services/merge-content.service.ts'),
		).toBe('effectiveContentMerge');
		expect(
			classifyIntakePublishingGroup(
				'src/pages/api/dashboard/intake/[id]/editor/sections/[section].ts',
			),
		).toBe('editorApi');
		expect(classifyIntakePublishingGroup('tests/unit/draft-to-published.mapper.test.ts')).toBe(
			'intakePublishingTests',
		);
		expect(classifyIntakePublishingGroup('src/lib/intake/types.ts')).toBeNull();
	});

	it('classifies invitation rendering files by public route boundary', () => {
		expect(classifyInvitationRenderingGroup('src/pages/[eventType]/[slug].astro')).toBe(
			'publicRoutes',
		);
		expect(classifyInvitationRenderingGroup('src/lib/invitation/page-data.ts')).toBe(
			'pageDataAssembly',
		);
		expect(classifyInvitationRenderingGroup('src/lib/adapters/event.ts')).toBe(
			'adapterViewModel',
		);
		expect(classifyInvitationRenderingGroup('src/lib/rsvp/services/foo.ts')).toBeNull();
	});

	it('classifies theme asset files without treating images as inventory', () => {
		expect(classifyThemeAssetGroup('src/lib/theme/theme-contract.ts')).toBe('themeVocabulary');
		expect(classifyThemeAssetGroup('src/lib/assets/asset-slug.ts')).toBe('assetSlugResolution');
		expect(classifyThemeAssetGroup('src/styles/themes/presets/_editorial.scss')).toBe(
			'themePresets',
		);
		expect(classifyThemeAssetGroup('src/styles/invitation/_section-primitives.scss')).toBe(
			'baseInvitationSectionStyles',
		);
		expect(classifyThemeAssetGroup('src/assets/images/events/demo-xv/hero.webp')).toBeNull();
		expect(classifyThemeAssetGroup('src/assets/images/events/demo-xv/index.ts')).toBeNull();
		expect(classifyThemeAssetGroup('src/styles/invitation/_hero.scss')).toBeNull();
		expect(classifyThemeAssetGroup('src/components/invitation/RSVP.tsx')).toBeNull();
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
// Stale-graph guard
// ---------------------------------------------------------------------------

describe('requireFreshGraph', () => {
	it('passes when graph commit matches HEAD', () => {
		expect(() => requireFreshGraph('abc123def', 'abc123def')).not.toThrow();
	});

	it('fails with actionable error when graph commit differs', () => {
		let error: Error;
		try {
			requireFreshGraph('oldcommit', 'newcommit');
		} catch (e) {
			error = e as Error;
		}
		expect(error!).toBeDefined();
		expect(error!.message).toContain('Graphify raw graph is stale.');
		expect(error!.message).toContain('Raw graph commit: oldcommit');
		expect(error!.message).toContain('Current HEAD: newcommit');
		expect(error!.message).toContain('graphify extract .');
		expect(error!.message).toContain('graphify cluster-only .');
		expect(error!.message).toContain('pnpm ops graphify-views');
	});

	it.each([null, undefined, ''])('fails when graph commit is %p', (commit) => {
		expect(() => requireFreshGraph(commit as string | null | undefined, 'abc123')).toThrow(
			'Graphify raw graph is stale.',
		);
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
			nodeCount: 52,
			linkCount: 30,
			graphCommunityCount: 33,
			analysisCommunityCount: 32,
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

	it('renders community summary markdown', () => {
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

	it('renders risk hubs markdown', () => {
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

		expect(singleNodeCommunities).toHaveLength(19);
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
		expect(sections.highConfidenceReviewCandidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'src/lib/isolated.ts' }),
			]),
		);
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

	it('renders cleanup markdown', () => {
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
			nodeCount: 52,
			linkCount: 30,
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
		const tests = reports.rsvpDomainReport.testsTouchingDomain as Array<
			Record<string, unknown>
		>;
		expect(tests).toEqual([
			expect.objectContaining({ sourceFile: 'tests/api/rsvp-v2.endpoints.test.ts' }),
		]);
	});

	it('renders RSVP domain markdown', () => {
		const markdown = renderRsvpDomainMarkdown(reports.rsvpDomainReport);
		expect(markdown).toContain('# Graphify Domain RSVP');
		expect(markdown).toContain('## practical-change-checklist');
		expect(markdown).toContain('RSVP submitted state');
		expect(markdown).toContain('Response editing / change my response');
		expect(markdown).toContain('src/pages/api/invitacion/[inviteId]/location.ts');
		expect(markdown).toContain('Add-to-calendar / time');
	});
});

describe('intake publishing domain report', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('groups intake publishing files by operational boundary', () => {
		const domain = reports.intakePublishingDomainReport;
		expect(domain).toMatchObject({
			domain: 'intake-publishing',
			domainNodeCount: 9,
			domainFileCount: 9,
		});
		expect(domain).not.toHaveProperty('generatedAt');

		const groups = domain.groups as Record<string, { files: Array<Record<string, unknown>> }>;
		expect(groups.editorUi.files).toEqual([
			expect.objectContaining({
				sourceFile: 'src/components/dashboard/intake/editor/InvitationEditor.tsx',
			}),
		]);
		expect(groups.effectiveContentMerge.files).toEqual([
			expect.objectContaining({
				sourceFile: 'src/lib/intake/services/merge-content.service.ts',
			}),
		]);
		expect(groups.draftPublishedMapping.files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceFile: 'src/lib/intake/mappers/draft-to-published.mapper.ts',
				}),
				expect.objectContaining({
					sourceFile: 'src/lib/intake/services/draft-content-mapper.ts',
				}),
			]),
		);
	});

	it('renders intake publishing checklist guidance', () => {
		const markdown = renderIntakePublishingDomainMarkdown(reports.intakePublishingDomainReport);
		expect(markdown).toContain('# Graphify Domain Intake Publishing');
		expect(markdown).toContain('likely related files');
		expect(markdown).toContain('Interludes');
		expect(markdown).toContain('_assetSlug');
		expect(markdown).toContain('Optimistic locking');
	});
});

describe('invitation rendering domain report', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('groups invitation rendering files by public route boundary', () => {
		const domain = reports.invitationRenderingDomainReport;
		expect(domain).toMatchObject({
			domain: 'invitation-rendering',
			domainNodeCount: 11,
			domainFileCount: 11,
		});

		const groups = domain.groups as Record<string, { files: Array<Record<string, unknown>> }>;
		expect(groups.publicRoutes.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/pages/[eventType]/[slug].astro' }),
		]);
		expect(groups.contentResolver.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/lib/invitation/content-resolver.ts' }),
		]);
		expect(groups.publicComponents.files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceFile: 'src/components/invitation/Hero.astro' }),
			]),
		);
	});

	it('renders invitation rendering checklist guidance', () => {
		const markdown = renderInvitationRenderingDomainMarkdown(
			reports.invitationRenderingDomainReport,
		);
		expect(markdown).toContain('# Graphify Domain Invitation Rendering');
		expect(markdown).toContain('Public route resolution');
		expect(markdown).toContain('DB/static fallback');
		expect(markdown).toContain('route slug vs `_assetSlug`');
	});
});

describe('theme assets domain report', () => {
	let reports: ReturnType<typeof generateFixtureReports>;

	beforeAll(() => {
		reports = generateFixtureReports();
	});

	it('groups only contract-oriented theme, section, and asset files', () => {
		const domain = reports.themeAssetsDomainReport;
		expect(domain).toMatchObject({
			domain: 'theme-assets',
			domainNodeCount: 8,
			domainFileCount: 8,
		});

		const groups = domain.groups as Record<string, { files: Array<Record<string, unknown>> }>;
		expect(groups.themeVocabulary.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/lib/theme/theme-contract.ts' }),
		]);
		expect(groups.assetRegistry.files).toEqual([
			expect.objectContaining({ sourceFile: 'src/lib/assets/asset-registry.ts' }),
		]);
		expect(groups.themeAssetTests.files).toEqual([
			expect.objectContaining({ sourceFile: 'tests/unit/theme-contract.test.ts' }),
		]);

		const serialized = JSON.stringify(domain);
		expect(serialized).not.toContain('hero.webp');
		expect(serialized).not.toContain('src/assets/images/events/');
		expect(serialized).not.toContain('src/styles/invitation/_hero.scss');
		expect(serialized).not.toContain('src/components/invitation/RSVP.tsx');
	});

	it('renders theme assets checklist guidance', () => {
		const markdown = renderThemeAssetsDomainMarkdown(reports.themeAssetsDomainReport);
		expect(markdown).toContain('# Graphify Domain Theme Assets');
		expect(markdown).toContain('SCSS only');
		expect(markdown).toContain('no Tailwind');
		expect(markdown).toContain('Expected centrality');
		expect(markdown).toContain('do not create section partials for symmetry');
		expect(markdown).not.toContain('src/assets/images/events/');
		expect(markdown).not.toContain('src/styles/invitation/_hero.scss');
		expect(markdown).not.toContain('src/components/invitation/RSVP.tsx');
	});
});

// ---------------------------------------------------------------------------
// CLI integration — one spawn to verify the full pipeline end-to-end
// ---------------------------------------------------------------------------

describe('CLI integration', () => {
	it('rejects stale fixture graph with actionable error', () => {
		const outputRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-'));

		try {
			let error: unknown;
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
			} catch (e) {
				error = e;
			}

			expect(error).toBeDefined();
			expect((error as Error).message).toContain('Graphify raw graph is stale.');
			expect((error as Error).message).toContain('Raw graph commit: abc123');
			expect((error as Error).message).toContain('graphify extract .');
			expect((error as Error).message).toContain('pnpm ops graphify-views');
		} finally {
			rmSync(outputRoot, { recursive: true, force: true });
		}
	});

	it('generates all 15 output files', () => {
		const tempRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-pass-'));
		const outputRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-out-'));

		try {
			const headCommit = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: ROOT,
			}).stdout.trim();
			const graph = JSON.parse(
				readFileSync(join(FIXTURE_ROOT, 'graph.json'), 'utf8'),
			) as Record<string, unknown>;
			graph.built_at_commit = headCommit;
			const tempGraphPath = join(tempRoot, 'graph.json');
			writeFileSync(tempGraphPath, JSON.stringify(graph), 'utf8');

			runCommand(
				'node',
				[
					CLI_PATH,
					'graphify-views',
					'--graph',
					tempGraphPath,
					'--analysis',
					join(FIXTURE_ROOT, '.graphify_analysis.json'),
					'--out',
					outputRoot,
				],
				{ cwd: ROOT },
			);

			const fileNames = [
				'README.md',
				'community-summary.json',
				'community-summary.md',
				'risk-hubs.json',
				'risk-hubs.md',
				'cleanup-report.json',
				'cleanup-report.md',
				'domain-rsvp.json',
				'domain-rsvp.md',
				'domain-intake-publishing.json',
				'domain-intake-publishing.md',
				'domain-invitation-rendering.json',
				'domain-invitation-rendering.md',
				'domain-theme-assets.json',
				'domain-theme-assets.md',
			];
			for (const file of fileNames) {
				expect(readFileSync(join(outputRoot, file), 'utf8')).toBeTruthy();
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
			rmSync(outputRoot, { recursive: true, force: true });
		}
	});

	it('produces deterministic output with expected README', () => {
		const tempRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-pass-'));
		const outputRoot = mkdtempSync(join(tmpdir(), 'graphify-operational-out-'));

		try {
			const headCommit = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: ROOT,
			}).stdout.trim();
			const graph = JSON.parse(
				readFileSync(join(FIXTURE_ROOT, 'graph.json'), 'utf8'),
			) as Record<string, unknown>;
			graph.built_at_commit = headCommit;
			const tempGraphPath = join(tempRoot, 'graph.json');
			writeFileSync(tempGraphPath, JSON.stringify(graph), 'utf8');

			runCommand(
				'node',
				[
					CLI_PATH,
					'graphify-views',
					'--graph',
					tempGraphPath,
					'--analysis',
					join(FIXTURE_ROOT, '.graphify_analysis.json'),
					'--out',
					outputRoot,
				],
				{ cwd: ROOT },
			);

			const firstRisk = readFileSync(join(outputRoot, 'risk-hubs.json'), 'utf8');
			runCommand(
				'node',
				[
					CLI_PATH,
					'graphify-views',
					'--graph',
					tempGraphPath,
					'--analysis',
					join(FIXTURE_ROOT, '.graphify_analysis.json'),
					'--out',
					outputRoot,
				],
				{ cwd: ROOT },
			);
			const secondRisk = readFileSync(join(outputRoot, 'risk-hubs.json'), 'utf8');
			const readme = readFileSync(join(outputRoot, 'README.md'), 'utf8');

			expect(secondRisk).toBe(firstRisk);
			expect(secondRisk).not.toContain('generatedAt');
			expect(readme).toContain('domain-intake-publishing.json');
			expect(readme).toContain('domain-invitation-rendering.json');
			expect(readme).toContain('domain-theme-assets.json');
			expect(readme).toContain('Graphify findings are leads, not authority');
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
			rmSync(outputRoot, { recursive: true, force: true });
		}
	});
});
