/** @jest-environment node */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const HELPER = pathToFileURL(path.resolve('scripts/agent/git-helpers.mjs')).href;

function probe(body: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`import cp from 'node:child_process';
			import { syncBuiltinESMExports } from 'node:module';
			import { pathToFileURL } from 'node:url';
			import path from 'node:path';
			const calls = [];
			let response = ${JSON.stringify({ status: 0, stdout: '  first\r\nlast  \r\n', stderr: ' warning\r\n' })};
			cp.spawnSync = (...args) => { calls.push(args); return response; };
			syncBuiltinESMExports();
			const h = await import(${JSON.stringify(HELPER)});
			${body}`,
		],
		{ cwd: process.cwd(), env: sanitizeEnv() },
	);
	return JSON.parse(result.stdout);
}

describe('shared agent Git helpers', () => {
	it('keeps lane-sync output intact and passes cwd, encoding and stdio', () => {
		const result = probe(`
			const result = h.runGit(['status'], 'checkout', { stdio: ['ignore', 'pipe', 'pipe'] });
			console.log(JSON.stringify({ result, calls }));
		`);
		expect(result).toEqual({
			result: { status: 0, stdout: '  first\r\nlast  \r\n', stderr: ' warning\r\n' },
			calls: [
				[
					'git',
					['status'],
					{ cwd: 'checkout', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
				],
			],
		});
	});

	it('trims worktree-status output without normalizing internal CRLF', () => {
		expect(probe(`console.log(JSON.stringify(h.runGit([], '.', { trim: 'both' })));`)).toEqual({
			status: 0,
			stdout: 'first\r\nlast',
			stderr: 'warning',
		});
	});

	it('preserves Git Safety normalization, leading spaces and buffer size', () => {
		const result = probe(
			`console.log(JSON.stringify({ result: h.git('.', ['status']), calls }));`,
		);
		expect(result.result).toEqual({ status: 0, stdout: '  first\nlast', stderr: ' warning' });
		expect(result.calls[0][2]).toEqual({
			cwd: '.',
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024,
		});
	});

	it('preserves strict failure messages, stdout fallback and allowFailure', () => {
		const result = probe(`
			response = ${JSON.stringify({ status: 7, stdout: ' fallback \r\n', stderr: ' detail \r\n' })};
			const messages = [];
			try { h.git('.', ['bad', 'argument']); } catch (e) { messages.push(e.message); }
			response.stderr = '';
			try { h.git('.', ['bad']); } catch (e) { messages.push(e.message); }
			response.stdout = '';
			try { h.git('.', ['bad']); } catch (e) { messages.push(e.message); }
			console.log(JSON.stringify({ messages, allowed: h.git('.', [], { allowFailure: true }) }));
		`);
		expect(result.messages).toEqual([
			'git bad argument failed: detail',
			'git bad failed: fallback',
			'git bad failed',
		]);
		expect(result.allowed).toEqual({ status: 7, stdout: '', stderr: '' });
	});

	it('throws spawn errors only for Git Safety, even with allowFailure', () => {
		expect(
			probe(`
			const error = new Error('spawn failed');
			response = { status: null, stdout: null, stderr: null, error };
			let sameError = false;
			try { h.git('.', [], { allowFailure: true }); } catch (e) { sameError = e === error; }
			console.log(JSON.stringify({ sameError, tolerant: h.runGit([], '.'), lane: h.gitOutput('.', [], {}) }));
		`),
		).toEqual({ sameError: true, tolerant: { status: 1, stdout: '', stderr: '' }, lane: null });
	});

	it('passes the lane inspection environment and returns null on failure', () => {
		const result = probe(`
			const success = h.gitOutput('.', ['status'], { GIT_OPTIONAL_LOCKS: '0' });
			response.status = 1;
			console.log(JSON.stringify({ success, failure: h.gitOutput('.', [], {}), calls }));
		`);
		expect(result.success).toBe('first\r\nlast');
		expect(result.failure).toBeNull();
		expect(result.calls[0][2]).toEqual({
			cwd: '.',
			encoding: 'utf8',
			env: { GIT_OPTIONAL_LOCKS: '0' },
		});
	});

	it('detects exact paths including spaces, relative paths and absent argv', () => {
		expect(
			probe(`
			const url = pathToFileURL(path.resolve('folder with spaces', 'entry.mjs')).href;
			process.argv = [process.execPath];
			console.log(JSON.stringify([
				h.isMainModule(url),
				h.isMainModule(url, { argv1: path.join('folder with spaces', 'entry.mjs') }),
				h.isMainModule(url, { argv1: 'other/entry.mjs' }),
				h.isMainModule(url, { argv1: 'folder with spaces/entry.mjs', resolveModulePath: true })
			]));
		`),
		).toEqual([false, true, false, true]);
	});

	it('retains legacy suffix and pattern detection independently of module URL', () => {
		expect(
			probe(`
			console.log(JSON.stringify([
				h.isMainModule(import.meta.url, { argv1: 'folder\\\\lane-sync.ts', suffix: 'lane-sync.ts' }),
				h.isMainModule(import.meta.url, { argv1: 'folder/lane-sync.js', suffix: 'lane-sync.ts' }),
				h.isMainModule(import.meta.url, { argv1: 'prefix-worktree-doctor.mjs', pattern: /worktree-doctor\\.(ts|js|mjs)$/ }),
				h.isMainModule(import.meta.url, { argv1: 'folder/env-files.js', pattern: /^env-files\\.(?:ts|js)$/, basenameOnly: true }),
				h.isMainModule(import.meta.url, { argv1: 'folder/prefix-env-files.js', pattern: /^env-files\\.(?:ts|js)$/, basenameOnly: true })
			]));
		`),
		).toEqual([true, false, true, true, false]);
	});
});
