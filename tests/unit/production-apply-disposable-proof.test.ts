import {
	DISPOSABLE_PROOF_REFRESH_COMMANDS,
	DisposableProofRefreshError,
	ensureFreshDisposableProof,
	refreshDisposableProofForPlan,
} from '../../scripts/db/production-apply-disposable-proof.ts';
import type { DisposableProofValidation } from '../../scripts/db/disposable-migration-proof.ts';

const valid: DisposableProofValidation = {
	ok: true,
	reason: 'Disposable migration proof matches the current migration set and live container.',
	proof: null,
	expectedDigest: 'digest',
};
const stale: DisposableProofValidation = {
	ok: false,
	reason: 'Disposable migration proof is stale relative to the current migration file set.',
	proof: null,
	expectedDigest: 'digest',
};

function sequence(...results: DisposableProofValidation[]): () => DisposableProofValidation {
	let index = 0;
	return () => results[Math.min(index++, results.length - 1)];
}

describe('prod:apply disposable proof refresh', () => {
	it('leaves a current proof alone and runs nothing', () => {
		const runPnpm = jest.fn(() => 0);
		const result = ensureFreshDisposableProof({
			assess: () => valid,
			runPnpm,
			log: () => undefined,
		});
		expect(result).toEqual({ refreshed: false, reason: valid.reason });
		expect(runPnpm).not.toHaveBeenCalled();
	});

	it('resets and re-applies disposable-test only, then re-checks the proof', () => {
		const runPnpm = jest.fn((_args: readonly string[]) => 0);
		const lines: string[] = [];
		const result = ensureFreshDisposableProof({
			assess: sequence(stale, valid),
			runPnpm,
			log: (line) => lines.push(line),
		});
		expect(result.refreshed).toBe(true);
		expect(runPnpm.mock.calls.map(([args]) => args)).toEqual(
			DISPOSABLE_PROOF_REFRESH_COMMANDS.map((args) => args),
		);
		expect(runPnpm.mock.calls[0][0]).toEqual(['db:disposable:reset']);
		expect(runPnpm.mock.calls[1][0]).toEqual(
			expect.arrayContaining(['--target', 'disposable-test', '--apply']),
		);
		expect(lines.join('\n')).toContain(stale.reason);
	});

	it('never names a persistent target in the refresh commands', () => {
		const flat = DISPOSABLE_PROOF_REFRESH_COMMANDS.flat().join(' ');
		expect(flat).not.toMatch(/production|preview|--target local|celebra-me-rsvp/);
	});

	it('stops before the apply when the reset fails', () => {
		const runPnpm = jest.fn((args: readonly string[]) =>
			args[0] === 'db:disposable:reset' ? 1 : 0,
		);
		expect(() =>
			ensureFreshDisposableProof({
				assess: () => stale,
				runPnpm,
				log: () => undefined,
			}),
		).toThrow(DisposableProofRefreshError);
		expect(runPnpm).toHaveBeenCalledTimes(1);
	});

	it('reports a spawn failure without an exit code', () => {
		expect(() =>
			ensureFreshDisposableProof({
				assess: () => stale,
				runPnpm: () => null,
				log: () => undefined,
			}),
		).toThrow(/código desconocido/);
	});

	it('fails closed when the proof is still invalid after the refresh', () => {
		expect(() =>
			ensureFreshDisposableProof({
				assess: () => stale,
				runPnpm: () => 0,
				log: () => undefined,
			}),
		).toThrow(/sigue sin validar/);
	});

	it('only refreshes for plans that include schema', () => {
		const assess = jest.fn(() => valid);
		const deps = { assess, runPnpm: () => 0, log: () => undefined };
		expect(
			refreshDisposableProofForPlan({ schema: false, inspectAll: false }, deps),
		).toBeNull();
		expect(assess).not.toHaveBeenCalled();
		expect(refreshDisposableProofForPlan({ schema: true, inspectAll: false }, deps)).toEqual({
			refreshed: false,
			reason: valid.reason,
		});
		expect(
			refreshDisposableProofForPlan({ schema: false, inspectAll: true }, deps),
		).not.toBeNull();
	});
});
