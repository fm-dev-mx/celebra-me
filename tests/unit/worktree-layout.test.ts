import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupFixture, createLaneFixture } from '../helpers/git-fixture';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

it('projects the same lane table from Integration and a linked checkout without inspecting missing siblings', () => {
	const parent = mkdtempSync(join(tmpdir(), 'lane-layout-'));
	try {
		const lane = createLaneFixture(parent, 'f09-docs', 'Layout Tester');
		const integration = join(parent, 'celebra-me');
		const layouts = [integration, lane].map((cwd) => {
			const result = runCommand(
				process.execPath,
				[join(process.cwd(), 'scripts/cli.mjs'), 'worktree-status', '--layout'],
				{ cwd, env: sanitizeEnv() },
			);
			expect(result.status).toBe(0);
			return JSON.parse(result.stdout) as {
				repoRoot: string;
				lanes: { id: string; port: number; runtimeDefault: string }[];
			};
		});
		// Windows paths are case-insensitive; cwd and Git may spell the drive folder differently.
		const comparable = (layout: unknown) =>
			process.platform === 'win32'
				? JSON.stringify(layout).toLowerCase()
				: JSON.stringify(layout);
		expect(comparable(layouts[0])).toBe(comparable(layouts[1]));
		expect(layouts[0].lanes.map((entry) => entry.port)).toEqual([
			4321, 4326, 4327, 4328, 4329, 4331, 4332,
		]);
		expect(
			layouts[0].lanes
				.filter((entry) => entry.runtimeDefault === 'preview')
				.map((entry) => entry.id),
		).toEqual(['f11-preview', 'f12-release']);
	} finally {
		cleanupFixture(parent);
	}
});
