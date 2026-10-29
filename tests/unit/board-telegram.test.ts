import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/telegram.mjs')).href;

function probe(code: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		const m = await import(process.argv[1]);
		${code}`,
			MODULE,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
	return JSON.parse(result.stdout);
}

describe('T437 / T442 telegram alerts integration', () => {
	it('handles unconfigured state gracefully without throwing', () => {
		const res = probe(`
			const r = await m.sendTelegramAlert('Test alert', { dir: 'nonexistent/dir' });
			console.log(JSON.stringify(r));
		`);
		expect(res).toEqual({ ok: false, reason: 'unconfigured' });
	});

	it('sends alert when configuration is present', () => {
		const res = probe(`
			const calls = [];
			const fakeFetch = async (url, init) => {
				calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
				return { ok: true, status: 200 };
			};
			const config = { token: 'bot123456:ABC-DEF', chatId: '987654321' };
			const r = await m.sendTelegramAlert('T442 ready to merge', {
				config,
				fetch: fakeFetch,
			});
			console.log(JSON.stringify({ r, calls }));
		`);

		expect(res.r).toEqual({ ok: true });
		expect(res.calls).toHaveLength(1);
		expect(res.calls[0].url).toBe('https://api.telegram.org/botbot123456:ABC-DEF/sendMessage');
		expect(res.calls[0].body).toEqual({
			chat_id: '987654321',
			text: 'T442 ready to merge',
		});
	});

	it('handles network failure without throwing or blocking', () => {
		const res = probe(`
			const failingFetch = async () => {
				throw new Error('Connection refused');
			};
			const config = { token: 'token', chatId: '123' };
			const r = await m.sendTelegramAlert('Alert', {
				config,
				fetch: failingFetch,
			});
			console.log(JSON.stringify(r));
		`);

		expect(res).toEqual({ ok: false, error: 'Connection refused' });
	});
});
