/**
 * Editor divergence wiring — server DTO → banner contract.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockIsLocalProcess = jest.fn<() => boolean>();

jest.mock('@/lib/server/deploy-identity', () => ({
	isLocalProcess: () => mockIsLocalProcess(),
}));

import {
	computeEditorDivergenceFromPaths,
	resolveEditorDivergence,
	resolveEditorManagedEnvironment,
	EditorEnvironmentMismatchError,
} from '../../src/lib/intake/services/editor-divergence.service.ts';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

function writeArtifact(root: string, slug: string, target: string): void {
	const dir = join(root, '.agent', 'runtime', 'reconciliation');
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, `reconciliation-${slug}-${target}.json`),
		JSON.stringify({
			reconciliationState: 'RECONCILIATION_REQUIRED',
			changedSemanticPaths: ['draftContent.hero.name', 'assets.hero'],
			isReleaseBlocked: true,
		}),
	);
}

beforeEach(() => {
	mockIsLocalProcess.mockReset();
	mockIsLocalProcess.mockReturnValue(true);
});

describe('Editor divergence environment binding', () => {
	it('classifies localhost as local', () => {
		expect(
			resolveEditorManagedEnvironment({
				supabaseUrl: LOCAL_SUPABASE_URL,
			}),
		).toBe('local');
	});

	it('fails closed on environment mismatch', () => {
		expect(() =>
			resolveEditorManagedEnvironment({
				supabaseUrl: LOCAL_SUPABASE_URL,
				expected: 'preview',
			}),
		).toThrow(EditorEnvironmentMismatchError);
	});
});

describe('Editor divergence CLEAN vs divergent states', () => {
	it('returns CLEAN with no banner fields when managed paths are empty', () => {
		const dto = computeEditorDivergenceFromPaths({
			targetEnvironment: 'local',
			changedPaths: ['rsvp.guestCount', 'invitationId', 'publishedContent'],
		});
		expect(dto.state).toBe('CLEAN');
		expect(dto.affectedFieldCount).toBe(0);
		expect(dto.isReleaseBlocked).toBe(false);
	});

	it('returns divergent banner contract for managed field paths', () => {
		const dto = computeEditorDivergenceFromPaths({
			targetEnvironment: 'local',
			changedPaths: ['draftContent.hero.name', 'themeId', 'rsvp.guestCount'],
			stateHint: 'RECONCILIATION_REQUIRED',
		});
		expect(dto.state).toBe('RECONCILIATION_REQUIRED');
		expect(dto.affectedFieldCount).toBe(2);
		expect(dto.affectedSections).toEqual(expect.arrayContaining(['draftContent', 'general']));
		expect(dto.isReleaseBlocked).toBe(true);
		expect(dto.targetEnvironment).toBe('local');
	});

	it('loads runtime reconciliation artifact outside versioned plan directories', () => {
		const root = join(tmpdir(), `celebra-editor-div-${Date.now()}`);
		writeArtifact(root, 'demo-slug', 'local');

		try {
			const dto = resolveEditorDivergence({
				slug: 'demo-slug',
				supabaseUrl: LOCAL_SUPABASE_URL,
				projectRoot: root,
			});
			expect(dto.state).toBe('RECONCILIATION_REQUIRED');
			expect(dto.affectedFieldCount).toBe(2);
			expect(dto.isReleaseBlocked).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('returns CLEAN in a local process without an artifact', () => {
		const dto = resolveEditorDivergence({
			slug: 'demo-slug',
			supabaseUrl: LOCAL_SUPABASE_URL,
			projectRoot: join(tmpdir(), `celebra-editor-div-missing-${Date.now()}`),
		});
		expect(dto.state).toBe('CLEAN');
		expect(dto.affectedFieldCount).toBe(0);
	});
});

describe('Editor divergence in a hosted runtime', () => {
	it('answers NOT_APPLICABLE and never reads the artifact', () => {
		mockIsLocalProcess.mockReturnValue(false);
		const root = join(tmpdir(), `celebra-editor-div-hosted-${Date.now()}`);
		writeArtifact(root, 'demo-slug', 'local');

		try {
			const dto = resolveEditorDivergence({
				slug: 'demo-slug',
				supabaseUrl: LOCAL_SUPABASE_URL,
				projectRoot: root,
			});
			expect(dto).toEqual({
				state: 'NOT_APPLICABLE',
				targetEnvironment: 'local',
				affectedFieldCount: 0,
				affectedSections: [],
				affectedSectionCount: 0,
				isReleaseBlocked: false,
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('still computes explicit paths, which need no filesystem', () => {
		mockIsLocalProcess.mockReturnValue(false);
		const dto = resolveEditorDivergence({
			slug: 'demo-slug',
			supabaseUrl: LOCAL_SUPABASE_URL,
			changedPaths: ['draftContent.hero.name'],
		});
		expect(dto.state).toBe('DIVERGED');
		expect(dto.affectedFieldCount).toBe(1);
	});

	it('keeps the environment mismatch fail-closed before skipping detection', () => {
		mockIsLocalProcess.mockReturnValue(false);
		expect(() =>
			resolveEditorDivergence({
				slug: 'demo-slug',
				supabaseUrl: LOCAL_SUPABASE_URL,
				expectedEnvironment: 'production',
			}),
		).toThrow(EditorEnvironmentMismatchError);
	});
});
