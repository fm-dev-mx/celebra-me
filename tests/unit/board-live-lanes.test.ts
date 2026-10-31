import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const LIVE_URL = pathToFileURL(path.join(process.cwd(), 'scripts/board/live.mjs')).href;

function probe(failList: boolean) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'--eval',
			`
		import { readLanes } from ${JSON.stringify(LIVE_URL)};
		import { resolve, join } from 'node:path';
		const parent = resolve('fixture with spaces');
		const integration = join(parent, 'celebra-me');
		const lane = join(parent, 'celebra-me-worktrees/f10-libre');
		const calls = [];
		const rows = await readLanes(join(integration, '.agent/tmp/board'), async (_bin, args, opts) => {
			calls.push({ args, cwd: opts.cwd });
			if (args[0] === 'worktree') {
				if (${failList}) throw new Error('unavailable');
				return { stdout: 'worktree ' + integration + '\\0HEAD abc\\0\\0worktree ' + lane + '\\0detached\\0\\0' };
			}
			return { stdout: args[0] === 'status' ? (opts.cwd === lane ? ' M example.ts' : '') : (opts.cwd === integration ? 'develop' : '') };
		});
		console.log(JSON.stringify({ rows, calls }));
	`,
		],
		{ cwd: process.cwd() },
	);
	return JSON.parse(result.stdout) as {
		rows: { id: string; rama?: string | null; limpio?: boolean; error?: string }[];
		calls: { args: string[]; cwd: string }[];
	};
}

describe('canonical live board lanes', () => {
	it('reads integration and registered lanes without stored lane records', () => {
		const { rows, calls } = probe(false);
		expect(rows).toHaveLength(8);
		expect(rows[0]).toEqual({ id: 'integration', rama: 'develop', limpio: true });
		expect(rows.find((row) => row.id === 'f10-libre')).toEqual({
			id: 'f10-libre',
			rama: null,
			limpio: false,
		});
		expect(rows.find((row) => row.id === 'f09-docs')?.error).toBeTruthy();
		expect(calls).toHaveLength(5);
		expect(calls[0].args).toEqual(['worktree', 'list', '--porcelain', '-z']);
	});

	it('reports unreadable Git inventory instead of calling lanes free', () => {
		const { rows, calls } = probe(true);
		expect(calls).toHaveLength(1);
		expect(rows).toHaveLength(8);
		expect(rows.every((row) => row.error && row.limpio === undefined)).toBe(true);
	});
});
