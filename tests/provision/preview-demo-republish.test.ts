/**
 * preview-demo-republish.test.ts — Preview demo republish contract
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	runPsql: jest.fn(),
	sqlLiteral: (value: string) => `'${value.replaceAll("'", "''")}'`,
	parsePsqlJson: jest.requireActual<typeof import('../../scripts/db/db-workflow-lib.ts')>(
		'../../scripts/db/db-workflow-lib.ts',
	).parsePsqlJson,
}));

jest.mock('../../scripts/db/db-target-config.ts', () => ({
	...jest.requireActual<typeof import('../../scripts/db/db-target-config.ts')>(
		'../../scripts/db/db-target-config.ts',
	),
	// Never fall back to a real gitignored secret file under test.
	resolveTargetDbUrl: (_target: string, env: NodeJS.ProcessEnv = process.env) =>
		env.PREVIEW_DB_URL?.trim() ?? '',
	classifyDbTarget: jest.fn(),
	validateEnvironmentUrlsPreflight: jest.fn(),
	redactDbUrl: (url: string) => url.replace(/\/\/.*@/, '//***@'),
}));

jest.mock('../../scripts/provision/preview-write-auth.ts', () => ({
	verifyPreviewWriteAuthorization: jest.fn(() => ({
		authorized: true,
		actor: 'automated_scoped_token',
	})),
	authorizePreviewWriteApply: jest.fn(async () => ({
		authorized: true,
		actor: 'automated_scoped_token',
	})),
}));

import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { classifyDbTarget } from '../../scripts/db/db-target-config.ts';
import {
	authorizePreviewWriteApply,
	verifyPreviewWriteAuthorization,
} from '../../scripts/provision/preview-write-auth.ts';
import {
	buildDemoPublishedContent,
	changedTopLevelSections,
	countCloudinaryUrls,
	PREVIEW_DEMO_REPUBLISH_OPERATION,
	republishPreviewDemo,
} from '../../scripts/provision/preview-demo-republish.ts';

const mockedPsql = runPsql as jest.MockedFunction<typeof runPsql>;
const mockedClassify = classifyDbTarget as jest.MockedFunction<typeof classifyDbTarget>;
const mockedVerify = verifyPreviewWriteAuthorization as jest.MockedFunction<
	typeof verifyPreviewWriteAuthorization
>;
const mockedAuthorize = authorizePreviewWriteApply as jest.MockedFunction<
	typeof authorizePreviewWriteApply
>;

const ENV = {
	PREVIEW_DB_URL: 'postgresql://user:pass@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
};
const SLUG = 'demo-xv-enchanted-rose';
const SOURCE = JSON.parse(
	readFileSync(`src/content/event-demos/xv/${SLUG}.json`, 'utf8'),
) as Record<string, unknown>;
const CURRENT = buildDemoPublishedContent(SOURCE);
const STALE = {
	...CURRENT,
	_assetSlug: 'demo-xv-editorial',
	music: { url: 'https://res.cloudinary.com/demo/video/upload/v1/song.mp3' },
};

function psqlResult(stdout: unknown) {
	return { status: 0, stdout: JSON.stringify(stdout), stderr: '' } as ReturnType<typeof runPsql>;
}

function demoRow(overrides: Record<string, unknown> = {}) {
	return {
		id: '22222222-2222-4222-8222-222222222222',
		invitation_id: '33333333-3333-4333-8333-333333333333',
		event_type: 'xv',
		version: 7,
		kind: 'demo',
		content: STALE,
		draft_content: null,
		...overrides,
	};
}

describe('preview-demo-republish content', () => {
	it('keeps underscore metadata the schema drops and marks the content as a demo', () => {
		expect(CURRENT._assetSlug).toBe(SLUG);
		expect(CURRENT.isDemo).toBe(true);
	});

	it('compares sections without regard to key order', () => {
		expect(changedTopLevelSections({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toEqual([]);
		expect(changedTopLevelSections({ a: 1, b: 2 }, { a: 1 })).toEqual(['b']);
	});

	it('counts Cloudinary URLs', () => {
		expect(countCloudinaryUrls(STALE)).toBe(1);
		expect(countCloudinaryUrls(CURRENT)).toBe(0);
	});
});

describe('republishPreviewDemo', () => {
	beforeEach(() => {
		mockedPsql.mockReset();
		mockedVerify.mockClear();
		mockedAuthorize.mockClear();
		mockedClassify.mockReset();
		mockedClassify.mockReturnValue({ target: 'preview', reason: 'preview host' } as never);
	});

	it('rejects Production before reading anything', async () => {
		mockedClassify.mockReturnValue({
			target: 'production',
			reason: 'production host',
		} as never);
		await expect(republishPreviewDemo({ slug: SLUG, env: ENV })).rejects.toThrow(
			/PREVIEW_DEMO_PRODUCTION_REJECTED/,
		);
		expect(mockedPsql).not.toHaveBeenCalled();
	});

	it('rejects slugs that are not demos', async () => {
		await expect(republishPreviewDemo({ slug: 'renata', env: ENV })).rejects.toThrow(
			/PREVIEW_DEMO_SLUG_REJECTED/,
		);
	});

	it('plans without writing on a dry-run', async () => {
		mockedPsql.mockReturnValueOnce(psqlResult([demoRow({ draft_content: STALE })]));
		const result = await republishPreviewDemo({ slug: SLUG, env: ENV });
		expect(result).toMatchObject({
			action: 'dry_run_update',
			changedSections: ['_assetSlug', 'music'],
			draftChanged: true,
			cloudinaryUrlsBefore: 2,
			cloudinaryUrlsAfter: 0,
		});
		expect(mockedPsql).toHaveBeenCalledTimes(1);
		expect(mockedVerify).not.toHaveBeenCalled();
	});

	it('reports unchanged demos and never writes them', async () => {
		mockedPsql.mockReturnValueOnce(psqlResult([demoRow({ content: CURRENT })]));
		const result = await republishPreviewDemo({ slug: SLUG, apply: true, env: ENV });
		expect(result.action).toBe('unchanged');
		expect(mockedPsql).toHaveBeenCalledTimes(1);
	});

	it('requires the exact demo-republish scope before reading Preview', async () => {
		mockedVerify.mockImplementationOnce(() => {
			throw new Error('PREVIEW_WRITE_AUTH_REQUIRED');
		});
		await expect(republishPreviewDemo({ slug: SLUG, apply: true, env: ENV })).rejects.toThrow(
			/PREVIEW_WRITE_AUTH_REQUIRED/,
		);
		expect(mockedVerify).toHaveBeenCalledWith(
			expect.objectContaining({ slug: SLUG, operation: PREVIEW_DEMO_REPUBLISH_OPERATION }),
		);
		expect(mockedPsql).not.toHaveBeenCalled();
	});

	it('writes the publication from the planned version in one statement', async () => {
		mockedPsql
			.mockReturnValueOnce(psqlResult([demoRow()]))
			.mockReturnValueOnce(psqlResult({ version: 8, published: 1, drafts: 0 }));
		const result = await republishPreviewDemo({ slug: SLUG, apply: true, env: ENV });
		expect(result).toMatchObject({ action: 'updated', publishedVersion: 8 });
		const sql = String(mockedPsql.mock.calls[1]?.[0]);
		expect(sql).toContain('and version = 7');
		expect(sql).toContain('exists (select 1 from pub)');
		expect(sql).not.toContain('res.cloudinary.com');
	});

	it('fails when the publication moved while planning', async () => {
		mockedPsql
			.mockReturnValueOnce(psqlResult([demoRow()]))
			.mockReturnValueOnce(psqlResult({ version: null, published: 0, drafts: 0 }));
		await expect(republishPreviewDemo({ slug: SLUG, apply: true, env: ENV })).rejects.toThrow(
			/PREVIEW_DEMO_STALE_PLAN/,
		);
	});

	it('rejects rows that are not demo invitations', async () => {
		mockedPsql.mockReturnValueOnce(psqlResult([demoRow({ kind: 'client' })]));
		await expect(republishPreviewDemo({ slug: SLUG, env: ENV })).rejects.toThrow(
			/PREVIEW_DEMO_KIND_REJECTED/,
		);
	});

	it('rejects demos without versioned JSON', async () => {
		mockedPsql.mockReturnValueOnce(psqlResult([demoRow({ event_type: 'xv', content: STALE })]));
		await expect(
			republishPreviewDemo({ slug: 'demo-xv-jewelry-box', env: ENV }),
		).rejects.toThrow(/PREVIEW_DEMO_SOURCE_MISSING/);
	});
});
