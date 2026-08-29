import {
	assertLoadBudget,
	assertSanitizedLoadReport,
	assertStagingOnlyTarget,
	projectValentinaMemoriesLoad,
	withoutLoadUnits,
	type SanitizedLoadReport,
} from '../../scripts/valentina-memories-load-plan';
import {
	parseValentinaMemoriesLoadArgs,
	runValentinaMemoriesLoadCli,
} from '../../scripts/valentina-memories-load';

describe('Valentina Memories bounded load CLI', () => {
	it('defaults to a sanitized cumulative dry-run for one reusable 100-session cohort', async () => {
		const report = await runValentinaMemoriesLoadCli([]);

		expect(report).toMatchObject({
			mode: 'dry-run',
			status: 'DRY_RUN_READY',
			projection: {
				cohortSessions: 100,
				onboardingSeconds: 600,
				residentObjectsAdded: 161,
				projectedRequests: 1247,
				stageObjects: {
					boundary: 1,
					smoke: 10,
					intermediate: 50,
					final: 100,
				},
				maxVideosPerSession: 1,
			},
		});
		expect(JSON.stringify(report)).not.toMatch(
			/cookie|recoveryCode|objectKey|uploadUrl|signature|credential|accountId/i,
		);
	});

	it('projects all optional resident objects without assuming logical cleanup releases quota', () => {
		const projection = projectValentinaMemoriesLoad({
			imageBytes: 1024,
			videoBytes: 4096,
			baselineObjects: 10,
			baselineBytes: 20_000,
			diagnostic25: true,
			soakMinutes: 30,
		});

		expect(projection.residentObjectsAdded).toBe(1_686);
		expect(projection.projectedResidentObjects).toBe(1_696);
		expect(projection.stageObjects).toMatchObject({ diagnostic: 25, soak: 1_500 });
		expect(projection.maxFilesPerSession).toBeLessThan(20);
		expect(projection.maxVideosPerSession).toBeLessThanOrEqual(2);
	});

	it('rejects Production signals and non-canonical Staging origins structurally', () => {
		for (const input of [
			{ target: 'production', origin: 'https://celebra-me.vercel.app' },
			{ target: 'staging', origin: 'https://www.celebra-me.com' },
			{
				target: 'staging',
				origin: 'https://celebra-me.vercel.app',
				deploymentLocator: 'production-current',
			},
			{ target: 'staging', origin: 'https://unlisted.example' },
		]) {
			expect(() => assertStagingOnlyTarget(input)).toThrow();
		}
		expect(() => parseValentinaMemoriesLoadArgs(['--target', 'production'])).toThrow(
			/Production is structurally rejected/,
		);
	});

	it('fails closed when budgets do not preserve a strict margin', () => {
		const projection = projectValentinaMemoriesLoad({
			imageBytes: 1024,
			videoBytes: 4096,
			baselineObjects: 0,
			baselineBytes: 0,
		});

		expect(() =>
			assertLoadBudget(projection, {
				objects: projection.projectedResidentObjects,
				bytes: projection.projectedResidentBytes + 1,
				requests: projection.projectedRequests,
			}),
		).toThrow(/owner margin/);
	});

	it('rejects unsafe report fields and strips ephemeral workload units', () => {
		const projection = projectValentinaMemoriesLoad({
			imageBytes: 1024,
			videoBytes: 4096,
			baselineObjects: 0,
			baselineBytes: 0,
		});
		expect(withoutLoadUnits(projection)).not.toHaveProperty('units');
		const unsafe = {
			schemaVersion: 1,
			mode: 'dry-run',
			status: 'DRY_RUN_READY',
			projection: withoutLoadUnits(projection),
			stages: [],
			cleanup: { logicallyInaccessible: 0, physicallyAbsent: 0, quotaReleased: false },
			providerMetrics: [],
			blockedReasons: [],
			objectKey: 'must-not-persist',
		} as unknown as SanitizedLoadReport;
		expect(() => assertSanitizedLoadReport(unsafe)).toThrow(/Unsafe report field/);
	});

	it('requires explicit owner authorization before any hosted execution preflight', async () => {
		const previous = process.env.VALENTINA_MEMORIES_LOAD_AUTHORIZATION;
		delete process.env.VALENTINA_MEMORIES_LOAD_AUTHORIZATION;
		await expect(runValentinaMemoriesLoadCli(['--execute'])).rejects.toThrow(
			/owner Staging execution authorization/,
		);
		if (previous === undefined) delete process.env.VALENTINA_MEMORIES_LOAD_AUTHORIZATION;
		else process.env.VALENTINA_MEMORIES_LOAD_AUTHORIZATION = previous;
	});
});
