/**
 * managed-status-git-hook.test.ts — Git hook skip + failure isolation
 */
import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const hookPath = path.resolve(process.cwd(), 'scripts/provision/managed-status-git-hook.mjs');

describe('managed-status Git hook', () => {
	it('skips automatic status when CELEBRA_SKIP_MANAGED_STATUS=1', () => {
		const result = spawnSync(process.execPath, [hookPath], {
			env: {
				...process.env,
				CELEBRA_SKIP_MANAGED_STATUS: '1',
			},
			encoding: 'utf8',
			timeout: 5_000,
			windowsHide: true,
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout ?? '').toBe('');
	});

	it('exits successfully when the status child process fails to start', () => {
		const env = { ...process.env };
		delete env.CELEBRA_SKIP_MANAGED_STATUS;
		env.CELEBRA_MANAGED_STATUS_HOOK_SCRIPT = path.resolve(
			process.cwd(),
			'scripts/provision/__missing-managed-status-runner__.mjs',
		);
		const result = spawnSync(process.execPath, [hookPath], {
			env,
			encoding: 'utf8',
			timeout: 5_000,
			windowsHide: true,
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
	});
});
