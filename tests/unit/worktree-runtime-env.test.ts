/**
 * Unit tests for worktree lane detection and Preview/Local runtime env bootstrap.
 * Does not touch real credentials or mutate worktrees.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertRuntimeSupabaseIdentity,
	bootstrapCelebraRuntimeEnv,
	classifySupabaseUrl,
	parseDeployEnvironment,
	PREVIEW_PROJECT_REF,
	PRODUCTION_PROJECT_REF,
	resolveRuntimeTarget,
} from '../../scripts/shared/celebra-runtime-env';
import {
	checkLaneWorkPolicy,
	detectWorktreeLane,
	getWorktreeDevServerPort,
	listExpectedLanePaths,
	WORKTREE_DEV_SERVER_PORTS,
} from '../../scripts/shared/worktree-lane';

describe('worktree lane detection', () => {
	const laneSegments = [
		'f05-plataforma',
		'f06-landing',
		'f07-invitaciones',
		'f08-demos',
		'f09-docs',
		'f10-libre',
		'f11-preview',
		'f12-release',
	] as const;

	it('recognizes Integration and the eight keyed lanes', () => {
		expect(detectWorktreeLane('/mock/celebra-me').id).toBe('integration');
		for (const segment of laneSegments) {
			expect(detectWorktreeLane(`/mock/celebra-me-worktrees/${segment}`).id).toBe(segment);
		}
	});

	it('detects lanes from Unix-style checkout roots as well', () => {
		expect(detectWorktreeLane('/home/dev/celebra-me').id).toBe('integration');
		expect(detectWorktreeLane('/home/dev/celebra-me-worktrees/f05-plataforma').id).toBe(
			'f05-plataforma',
		);
		expect(detectWorktreeLane('/home/dev/celebra-me-worktrees/f11-preview').id).toBe(
			'f11-preview',
		);
	});

	it('does not recognize paths outside the canonical external layout', () => {
		expect(detectWorktreeLane('/mock/celebra-me/.worktrees/f05-plataforma').id).toBe('unknown');
		expect(detectWorktreeLane('/mock/celebra-me/.claude/worktrees/task-1a2b').id).toBe(
			'unknown',
		);
		expect(detectWorktreeLane('/mock/celebra-me-worktrees/f05-plataforma2').id).toBe('unknown');
		// Retired lane folders are no longer lanes.
		expect(detectWorktreeLane('/mock/celebra-me-worktrees/dev-local').id).toBe('unknown');
	});

	it('does not treat a linked worktree named like the repository as Integration', () => {
		const parent = mkdtempSync(join(tmpdir(), 'linked-worktree-'));
		try {
			const checkout = join(parent, 'celebra-me');
			mkdirSync(checkout);
			expect(detectWorktreeLane(checkout).id).toBe('integration');
			writeFileSync(join(checkout, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n');
			expect(detectWorktreeLane(checkout).id).toBe('unknown');
		} finally {
			rmSync(parent, { recursive: true, force: true });
		}
	});

	it('detects lanes from subdirectories of a lane checkout', () => {
		expect(detectWorktreeLane('/mock/celebra-me-worktrees/f10-libre/src').id).toBe('f10-libre');
	});

	it('lists expected lane paths, keys and runtimes under the repository root', () => {
		const lanes = listExpectedLanePaths('/mock/celebra-me');
		expect(lanes.map((lane) => lane.id)).toEqual(['integration', ...laneSegments]);
		expect(lanes.map((lane) => lane.key)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
		expect(
			lanes.filter((lane) => lane.runtimeDefault === 'preview').map((lane) => lane.id),
		).toEqual(['f11-preview', 'f12-release']);
	});

	it('derives ports from the lane key', () => {
		expect(getWorktreeDevServerPort('integration')).toBe(4321);
		expect(getWorktreeDevServerPort('f05-plataforma')).toBe(4325);
		expect(getWorktreeDevServerPort('f08-demos')).toBe(4328);
		expect(getWorktreeDevServerPort('f11-preview')).toBe(4331);
		expect(getWorktreeDevServerPort('f12-release')).toBe(4332);
		expect(getWorktreeDevServerPort('unknown')).toBe(4399);
	});

	it('never lets two Local lanes share a port', () => {
		const localPorts = listExpectedLanePaths('/mock/celebra-me')
			.filter((lane) => lane.runtimeDefault === 'local')
			.map((lane) => WORKTREE_DEV_SERVER_PORTS[lane.id]);
		expect(localPorts).toHaveLength(7);
		expect(new Set(localPorts).size).toBe(localPorts.length);
		expect(localPorts).not.toContain(WORKTREE_DEV_SERVER_PORTS.unknown);
	});
});

describe('lane work policy', () => {
	const lane = (path: string) => detectWorktreeLane(path);

	it('refuses the unknown lane and names every keyed lane', () => {
		const message = checkLaneWorkPolicy({
			lane: lane('/mock/celebra-me/.claude/worktrees/x'),
			branch: 'feat/x',
		});
		expect(message).toContain('lane: unknown');
		expect(message).toContain('f05-plataforma (Win + F5)');
		expect(message).toContain('f12-release (Win + F12)');
	});

	it('allows Integration sessions on develop and only merge commits on develop', () => {
		const integration = lane('/mock/celebra-me');
		expect(checkLaneWorkPolicy({ lane: integration, branch: 'develop' })).toBeNull();
		expect(
			checkLaneWorkPolicy({ lane: integration, branch: 'feat/x', merging: true }),
		).toContain('only takes commits on develop');
		expect(
			checkLaneWorkPolicy({ lane: integration, branch: 'develop', operation: 'commit' }),
		).toContain('direct task commits are forbidden');
		expect(
			checkLaneWorkPolicy({
				lane: integration,
				branch: 'develop',
				operation: 'commit',
				merging: true,
			}),
		).toBeNull();
		expect(checkLaneWorkPolicy({ lane: integration, branch: 'feat/x' })).toContain(
			'only takes commits on develop (current: feat/x)',
		);
		expect(checkLaneWorkPolicy({ lane: integration, branch: null })).toContain('detached HEAD');
	});

	it('allows any branch in a keyed lane', () => {
		const docs = lane('/mock/celebra-me-worktrees/f09-docs');
		expect(checkLaneWorkPolicy({ lane: docs, branch: 'chore/x' })).toBeNull();
	});
});

describe('celebra runtime env bootstrap', () => {
	const originalEnv = { ...process.env };
	let tempRoot = '';

	beforeEach(() => {
		process.env = { ...originalEnv, NODE_ENV: 'development' };
		delete process.env.CELEBRA_DEPLOY_ENV;
		delete process.env.CELEBRA_RUNTIME_TARGET;
		delete process.env.SUPABASE_URL;
		delete process.env.PUBLIC_SUPABASE_URL;
		delete process.env.SUPABASE_ANON_KEY;
		delete process.env.PUBLIC_SUPABASE_ANON_KEY;
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		tempRoot = mkdtempSync(join(tmpdir(), 'celebra-env-'));
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
	});

	function writeLane(segment: string | null) {
		const cwd = segment
			? join(tempRoot, 'celebra-me-worktrees', segment)
			: join(tempRoot, 'celebra-me');
		mkdirSync(cwd, { recursive: true });
		return cwd;
	}

	it('classifies Local, Preview, and Production Supabase URLs', () => {
		expect(classifySupabaseUrl('http://127.0.0.1:54321')).toBe('local');
		expect(classifySupabaseUrl(`https://${PREVIEW_PROJECT_REF}.supabase.co`)).toBe('preview');
		expect(classifySupabaseUrl(`https://${PRODUCTION_PROJECT_REF}.supabase.co`)).toBe(
			'production',
		);
	});

	it('resolves Preview runtime from the f11-preview worktree without a deploy identity', () => {
		const cwd = writeLane('f11-preview');
		expect(resolveRuntimeTarget({ cwd }).target).toBe('preview');
	});

	it('parses CELEBRA_DEPLOY_ENV exactly, like the runtime deploy identity', () => {
		expect(parseDeployEnvironment(undefined)).toBeNull();
		expect(parseDeployEnvironment('')).toBeNull();
		expect(parseDeployEnvironment('production')).toBe('production');
		expect(parseDeployEnvironment('preview')).toBe('preview');
		for (const invalid of ['Production', ' preview', 'PREVIEW', 'staging', ' ']) {
			expect(() => parseDeployEnvironment(invalid)).toThrow(/must be exactly/);
		}
		expect(() =>
			resolveRuntimeTarget({
				cwd: writeLane('f05-plataforma'),
				env: { CELEBRA_DEPLOY_ENV: 'Production' },
			}),
		).toThrow(/must be exactly/);
	});

	it('rejects mixed Local/Preview public and server URLs', () => {
		expect(() =>
			assertRuntimeSupabaseIdentity(
				{
					SUPABASE_URL: 'http://127.0.0.1:54321',
					PUBLIC_SUPABASE_URL: `https://${PREVIEW_PROJECT_REF}.supabase.co`,
				},
				'local',
			),
		).toThrow(/same project/);
	});

	it('rejects Production credentials for Preview runtime', () => {
		expect(() =>
			assertRuntimeSupabaseIdentity(
				{
					SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
					PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
					SUPABASE_ANON_KEY: 'x',
					PUBLIC_SUPABASE_ANON_KEY: 'x',
					SUPABASE_SERVICE_ROLE_KEY: 'x',
				},
				'preview',
			),
		).toThrow(/Production/);
	});

	it('bootstraps Preview lane from .env.preview.local', () => {
		const cwd = writeLane('f11-preview');
		writeFileSync(
			join(cwd, '.env.local'),
			[
				'NODE_ENV=development',
				'SUPABASE_URL=http://127.0.0.1:54321',
				'PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
			].join('\n'),
		);
		writeFileSync(
			join(cwd, '.env.preview.local'),
			[
				`SUPABASE_URL=https://${PREVIEW_PROJECT_REF}.supabase.co`,
				`PUBLIC_SUPABASE_URL=https://${PREVIEW_PROJECT_REF}.supabase.co`,
				'SUPABASE_ANON_KEY=preview-anon',
				'PUBLIC_SUPABASE_ANON_KEY=preview-anon',
				'SUPABASE_SERVICE_ROLE_KEY=preview-service',
			].join('\n'),
		);

		const result = bootstrapCelebraRuntimeEnv({ cwd, validate: true });
		expect(result.target).toBe('preview');
		expect(process.env.CELEBRA_RUNTIME_TARGET).toBe('preview');
		expect(classifySupabaseUrl(process.env.SUPABASE_URL)).toBe('preview');
		expect(classifySupabaseUrl(process.env.PUBLIC_SUPABASE_URL)).toBe('preview');
	});

	it('fails closed when Preview lane lacks .env.preview.local', () => {
		const cwd = writeLane('f11-preview');
		writeFileSync(
			join(cwd, '.env.local'),
			[
				'NODE_ENV=development',
				'SUPABASE_URL=http://127.0.0.1:54321',
				'PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
			].join('\n'),
		);
		expect(() => bootstrapCelebraRuntimeEnv({ cwd, validate: true })).toThrow(
			/\.env\.preview\.local/,
		);
	});
});
