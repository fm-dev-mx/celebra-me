import { describe, expect, it } from '@jest/globals';
import {
	ProductionApplyTimings,
	formatProductionApplyTimings,
} from '../../scripts/db/production-apply-timings.ts';

describe('production apply timings', () => {
	it('records nested synchronous backups independently from inclusive publication time', async () => {
		let now = 0;
		const timings = new ProductionApplyTimings(() => now);
		await timings.measure(
			'publication',
			() => {
				timings.measureSync(
					'backup',
					() => {
						now += 100;
					},
					'fixture',
				);
				now += 200;
			},
			'fixture',
		);
		expect(timings.rows.map((row) => row.durationMs)).toEqual([100, 300]);
		const failure = new Error('backup failed');
		expect(() =>
			timings.measureSync('backup', () => {
				now += 50;
				throw failure;
			}),
		).toThrow(failure);
		expect(timings.rows[2]).toEqual({ phase: 'backup', durationMs: 50, status: 'failed' });
	});
	it('retains elapsed time and the original error for a failed phase', async () => {
		let now = 0;
		const timings = new ProductionApplyTimings(() => now);
		const failure = new Error('synthetic failure');
		await expect(
			timings.measure(
				'verification',
				async () => {
					now = 1234;
					throw failure;
				},
				'fixture:después',
			),
		).rejects.toBe(failure);
		expect(timings.rows).toEqual([
			{ phase: 'verification', id: 'fixture:después', durationMs: 1234, status: 'failed' },
		]);
		expect(formatProductionApplyTimings(timings.rows)).toContain(
			'Verificación de imágenes | fixture:después | 1.234 | Falló',
		);
		expect(formatProductionApplyTimings([])).toBe('');
	});
});
