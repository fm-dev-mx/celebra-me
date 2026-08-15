import { describe, expect, it } from '@jest/globals';
import {
	formatInvitationGuidance,
	rejectPastedCommandPrefix,
	translatePreconditionFailure,
} from '../../scripts/provision/invitation-operator-guidance.ts';
import { checkUnknownFlags } from '../../scripts/provision/invitation-update-options.ts';
import { formatApplyResult } from '../../scripts/provision/invitation-update-presenter.ts';

describe('invitation operator guidance', () => {
	it('rejects a pasted script prefix without accepting it', () => {
		expect(() =>
			rejectPastedCommandPrefix([
				'pnpm',
				'invitation:release',
				'--',
				'--slug',
				'renata',
				'--targets',
				'preview',
				'--apply',
			]),
		).toThrow(/PASTED_SCRIPT_PREFIX[\s\S]*--slug renata --targets preview --apply/);
	});

	it('rejects a lone pnpm separator with the task prompt', () => {
		expect(() => checkUnknownFlags(['--', '--slug', 'renata'])).toThrow(
			/PASTED_PNPM_SEPARATOR[\s\S]*--slug <slug> --targets preview --apply/,
		);
	});

	it('explains Preview auth with the invitation:release task prompt', () => {
		const text = formatInvitationGuidance(
			'PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation for "renata" requires an explicit task scope.',
			'renata',
			'preview',
		);
		expect(text).toContain('Preview no autorizado');
		expect(text).toContain('Esta ejecución no es TTY');
		expect(text).toContain('No se escribió nada.');
		expect(text).toContain('--slug renata --targets preview --apply');
		expect(text).not.toContain('$env:CELEBRA_TASK_SCOPE');
		expect(text).not.toContain('pnpm invitation:release');
		expect(text).toContain('PREVIEW_WRITE_AUTH_REQUIRED');
	});

	it('names the PRECONDITION_FAILED mismatch class without hashes or paths', () => {
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: The package source changed after planning.',
			),
		).toContain('origen del paquete');
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: The resolved package changed after planning.',
			),
		).toContain('paquete resuelto');
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: Precondition failed: target draft updated timestamp changed after planning (expected 2026-01-01, got 2026-01-02).',
			),
		).toContain('borrador del destino');
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: Precondition failed: target published version changed after planning (expected 2, got 3).',
			),
		).toContain('versión publicada');
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: The planned functional or technical operation set changed before execution.',
			),
		).toContain('identificador del plan');
		expect(
			translatePreconditionFailure(
				'PRECONDITION_FAILED: Apply requires the exact target plan produced by preflight.',
			),
		).toContain('identificador del plan');
		const fallback = translatePreconditionFailure(
			'PRECONDITION_FAILED: The verified target project changed after planning.',
		);
		expect(fallback).toContain('origen, el paquete o el estado del destino');
		expect(fallback).not.toMatch(/[A-Za-z]:\\/);
		expect(fallback).not.toMatch(/\b[a-f0-9]{64}\b/);
	});

	it('hides planned diffs on an unwritten Preview auth failure', () => {
		const text = formatApplyResult({
			invitation: 'renata',
			status: 'ERROR — REQUIERE REVISIÓN',
			environment: 'preview',
			completedOperations: 0,
			databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			reason: 'PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation for "renata" requires an explicit task scope.',
			functionalChanges: [
				{
					section: 'Itinerary',
					entity: 'Hora',
					label: 'Hora',
					operation: 'update',
					previousValue: 'Por confirmar',
					newValue: '9:00 p. m.',
					scope: 'database',
					technicalWriteCount: 1,
				},
			],
			targetResults: [
				{
					target: 'preview',
					status: 'ERROR — REQUIERE REVISIÓN',
					reason: 'PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation for "renata" requires an explicit task scope.',
					completedOperations: 0,
					databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					functionalChanges: [
						{
							section: 'Itinerary',
							entity: 'Hora',
							label: 'Hora',
							operation: 'update',
							previousValue: 'Por confirmar',
							newValue: '9:00 p. m.',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
			],
		});
		expect(text).toContain('Preview no autorizado');
		expect(text).toContain('--slug renata --targets preview --apply');
		expect(text).not.toContain('$env:CELEBRA_TASK_SCOPE');
		expect(text).toContain('Plan no aplicado');
		expect(text).toContain('0 inserciones');
		expect(text).not.toContain('ACTUALIZACIONES');
		expect(text).not.toContain('9:00 p. m.');
	});
});
