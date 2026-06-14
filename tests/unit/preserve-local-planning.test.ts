import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SlugDiff, StorageReference } from '../../scripts/db/preserve-local-lib.ts';
import {
	PRESERVE_TABLE_ORDER,
	buildDryRunReport,
	classifySlugs,
	formatDryRunReport,
	validateExportDump,
} from '../../scripts/db/preserve-local-lib.ts';

describe('classifySlugs', () => {
	const local = [
		{ slug: 'a', id: '1', eventType: null },
		{ slug: 'b', id: '2', eventType: null },
		{ slug: 'c', id: '3', eventType: 'xv' },
	];
	const prod = [
		{ slug: 'b', id: '99', eventType: null },
		{ slug: 'd', id: '100', eventType: null },
	];

	it('detects local-only slugs', () => {
		const result = classifySlugs(local, prod);
		expect(result.localOnly.map((s) => s.slug)).toEqual(['a', 'c']);
	});

	it('detects overlapping slugs', () => {
		const result = classifySlugs(local, prod);
		expect(result.overlapping.map((s) => s.slug)).toEqual(['b']);
	});

	it('detects production-only slugs', () => {
		const result = classifySlugs(local, prod);
		expect(result.prodOnly.map((s) => s.slug)).toEqual(['d']);
	});

	it('returns empty arrays when no slugs in either side', () => {
		const result = classifySlugs([], []);
		expect(result.localOnly).toEqual([]);
		expect(result.overlapping).toEqual([]);
		expect(result.prodOnly).toEqual([]);
	});

	it('handles event_type in composite identity for published content', () => {
		const localPub = [
			{ slug: 'a', id: '1', eventType: 'xv' },
			{ slug: 'a', id: '2', eventType: 'boda' },
		];
		const prodPub = [{ slug: 'a', id: '99', eventType: 'xv' }];
		const result = classifySlugs(localPub, prodPub);
		expect(result.overlapping.map((s) => s.id)).toEqual(['1']);
		expect(result.localOnly.map((s) => s.id)).toEqual(['2']);
	});
});

describe('buildDryRunReport', () => {
	const slugDiff: SlugDiff = {
		invitations: {
			localOnly: [{ slug: 'local-inv', id: 'aaa', eventType: null }],
			overlapping: [{ slug: 'shared-inv', id: 'bbb', eventType: null }],
			prodOnly: [{ slug: 'prod-inv', id: 'ccc', eventType: null }],
		},
		events: {
			localOnly: [{ slug: 'local-evt', id: 'ddd', eventType: 'xv' }],
			overlapping: [],
			prodOnly: [{ slug: 'prod-evt', id: 'eee', eventType: null }],
		},
		published: {
			localOnly: [],
			overlapping: [],
			prodOnly: [],
		},
	};

	const preservedRows: Record<string, { id: string }[]> = {
		invitations: [{ id: 'aaa' }],
		events: [{ id: 'ddd' }],
		invitation_content_drafts: [{ id: 'f1' }],
		invitation_assets: [{ id: 'g1' }, { id: 'g2' }],
	};

	const storageRefs: StorageReference[] = [
		{
			table: 'invitation_assets',
			id: 'g1',
			storagePath: 'static/demo/image.jpg',
			bucket: 'invitation-assets',
			status: 'static_asset',
			invitationSlug: 'local-inv',
		},
		{
			table: 'invitation_assets',
			id: 'g2',
			storagePath: 'uploads/image.jpg',
			bucket: 'invitation-assets',
			status: 'local_storage',
			invitationSlug: 'local-inv',
		},
	];

	it('produces a report with all sections', () => {
		const report = buildDryRunReport(
			slugDiff,
			preservedRows,
			storageRefs,
			['auth-1', 'auth-2'],
			['Risk: overlapping slugs will be overwritten'],
			['Ambiguous: published content with null event_type'],
		);

		expect(report.slugDiff).toBe(slugDiff);
		expect(report.preservedCounts.invitations).toBe(1);
		expect(report.preservedCounts.events).toBe(1);
		expect(report.preservedCounts.invitation_assets).toBe(2);
		expect(report.authUserIds).toEqual(['auth-1', 'auth-2']);
		expect(report.risks).toHaveLength(1);
		expect(report.ambiguous).toHaveLength(1);
	});

	it('counts zero for tables not in preservedRows', () => {
		const report = buildDryRunReport(slugDiff, {}, [], [], [], []);
		expect(report.preservedCounts).toEqual({});
	});
});

describe('formatDryRunReport', () => {
	it('returns a non-empty string with key sections', () => {
		const report = buildDryRunReport(
			{
				invitations: {
					localOnly: [{ slug: 'test', id: '1', eventType: null }],
					overlapping: [],
					prodOnly: [],
				},
				events: { localOnly: [], overlapping: [], prodOnly: [] },
				published: { localOnly: [], overlapping: [], prodOnly: [] },
			},
			{ invitations: [{ id: '1' }] },
			[],
			[],
			[],
			[],
		);
		const output = formatDryRunReport(report);
		expect(output).toContain('Dry-Run');
		expect(output).toContain('test');
		expect(output).toContain('invitations');
	});

	it('includes risks and ambiguous sections when present', () => {
		const report = buildDryRunReport(
			{
				invitations: { localOnly: [], overlapping: [], prodOnly: [] },
				events: { localOnly: [], overlapping: [], prodOnly: [] },
				published: { localOnly: [], overlapping: [], prodOnly: [] },
			},
			{},
			[],
			['auth-1'],
			['Test risk'],
			['Test ambiguous'],
		);
		const output = formatDryRunReport(report);
		expect(output).toContain('Test risk');
		expect(output).toContain('Test ambiguous');
		expect(output).toContain('auth-1');
	});
});

describe('validateExportDump', () => {
	const tmpDir = mkdtempSync(join(tmpdir(), 'preserve-test-'));
	const tmpFile = join(tmpDir, 'test-export.sql');

	afterAll(() => {
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	it('passes for a valid dump with COPY blocks', () => {
		writeFileSync(
			tmpFile,
			['COPY public.invitations (id, slug) FROM stdin;', '1\ttest', '\\.'].join('\n'),
			'utf8',
		);
		expect(validateExportDump(tmpFile)).toBe(true);
	});

	it('succeeds for a dump with no COPY blocks (empty preserve)', () => {
		writeFileSync(tmpFile, '-- empty dump\n', 'utf8');
		expect(validateExportDump(tmpFile)).toBe(true);
	});
});

describe('PRESERVE_TABLE_ORDER', () => {
	it('is a non-empty ordered array', () => {
		expect(PRESERVE_TABLE_ORDER.length).toBeGreaterThan(0);
	});

	it('lists invitations before events (FK-safe)', () => {
		const invIdx = PRESERVE_TABLE_ORDER.indexOf('invitations');
		const evtIdx = PRESERVE_TABLE_ORDER.indexOf('events');
		expect(invIdx).toBeLessThan(evtIdx);
	});

	it('lists intake_requests before intake_submissions (FK-safe)', () => {
		const reqIdx = PRESERVE_TABLE_ORDER.indexOf('intake_requests');
		const subIdx = PRESERVE_TABLE_ORDER.indexOf('intake_submissions');
		expect(reqIdx).toBeLessThan(subIdx);
	});

	it('lists events before their FK children', () => {
		const evtIdx = PRESERVE_TABLE_ORDER.indexOf('events');
		expect(PRESERVE_TABLE_ORDER.indexOf('guest_invitations')).toBeGreaterThan(evtIdx);
		expect(PRESERVE_TABLE_ORDER.indexOf('event_memberships')).toBeGreaterThan(evtIdx);
		expect(PRESERVE_TABLE_ORDER.indexOf('event_claim_codes')).toBeGreaterThan(evtIdx);
	});
});
