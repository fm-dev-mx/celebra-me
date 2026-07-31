/**
 * Editor divergence wiring — server DTO → banner contract.
 */
import { describe, expect, it } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	computeEditorDivergenceFromPaths,
	resolveEditorDivergence,
	resolveEditorManagedEnvironment,
	EditorEnvironmentMismatchError,
} from '../../src/lib/intake/services/editor-divergence.service.ts';

describe('Editor divergence environment binding', () => {
	it('classifies localhost as local', () => {
		expect(
			resolveEditorManagedEnvironment({
				supabaseUrl: 'http://127.0.0.1:54321',
			}),
		).toBe('local');
	});

	it('fails closed on environment mismatch', () => {
		expect(() =>
			resolveEditorManagedEnvironment({
				supabaseUrl: 'http://127.0.0.1:54321',
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
		const dir = join(root, '.agent', 'runtime', 'reconciliation');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, 'reconciliation-demo-slug-local.json'),
			JSON.stringify({
				reconciliationState: 'RECONCILIATION_REQUIRED',
				changedSemanticPaths: ['draftContent.hero.name', 'assets.hero'],
				isReleaseBlocked: true,
			}),
		);

		try {
			const dto = resolveEditorDivergence({
				slug: 'demo-slug',
				supabaseUrl: 'http://127.0.0.1:54321',
				projectRoot: root,
			});
			expect(dto.state).toBe('RECONCILIATION_REQUIRED');
			expect(dto.affectedFieldCount).toBe(2);
			expect(dto.isReleaseBlocked).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
