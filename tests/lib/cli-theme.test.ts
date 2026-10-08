import { describe, expect, it } from '@jest/globals';
import {
	colorEnabled,
	createTheme,
	padVisible,
	promptTheme,
	stripAnsi,
	unicodeEnabled,
	visibleWidth,
} from '../../scripts/lib/cli-theme.ts';

const tty = { stdout: { isTTY: true }, stderr: { isTTY: true } };
const piped = { stdout: { isTTY: false }, stderr: { isTTY: true } };

describe('cli-theme capability detection', () => {
	it('respects NO_COLOR, FORCE_COLOR and a redirected stdout', () => {
		expect(colorEnabled({ NO_COLOR: '1' }, tty)).toBe(false);
		expect(colorEnabled({ FORCE_COLOR: '1' }, piped)).toBe(true);
		expect(colorEnabled({ FORCE_COLOR: '0' }, tty)).toBe(false);
		expect(colorEnabled({}, tty)).toBe(true);
		expect(colorEnabled({}, piped)).toBe(false);
	});

	it('falls back to ASCII on legacy Windows consoles only', () => {
		expect(unicodeEnabled({}, 'win32')).toBe(false);
		expect(unicodeEnabled({ WT_SESSION: 'x' }, 'win32')).toBe(true);
		expect(unicodeEnabled({ MSYSTEM: 'MINGW64' }, 'win32')).toBe(true);
		expect(unicodeEnabled({ TERM_PROGRAM: 'vscode' }, 'win32')).toBe(true);
		expect(unicodeEnabled({}, 'linux')).toBe(true);
		expect(unicodeEnabled({ TERM: 'linux' }, 'linux')).toBe(false);
		expect(unicodeEnabled({ CELEBRA_CLI_ASCII: '1', WT_SESSION: 'x' }, 'win32')).toBe(false);
	});
});

describe('cli-theme rendering', () => {
	it('keeps fixed semantic colors and bold red Production', () => {
		const theme = createTheme({ env: { FORCE_COLOR: '1' }, streams: tty, platform: 'linux' });
		expect(theme.ok('x')).toBe('\x1b[32mx\x1b[39m');
		expect(theme.warn('x')).toBe('\x1b[33mx\x1b[39m');
		expect(theme.fail('x')).toBe('\x1b[31mx\x1b[39m');
		expect(theme.info('x')).toBe('\x1b[36mx\x1b[39m');
		expect(theme.env('local')).toContain('\x1b[32m');
		expect(theme.env('preview')).toContain('\x1b[33m');
		expect(theme.env('production')).toBe('\x1b[1m\x1b[31mProduction\x1b[39m\x1b[22m');
	});

	it('produces plain text without color and ASCII symbols when unicode is unsupported', () => {
		const theme = createTheme({ env: { NO_COLOR: '1' }, streams: tty, platform: 'win32' });
		expect(theme.enabled).toBe(false);
		expect(theme.unicode).toBe(false);
		expect(theme.mark('ok', 'done')).toBe('+ done');
		expect(theme.mark('fail', 'bad')).toBe('x bad');
		expect(theme.symbol('warn')).toBe('!');
		expect(theme.header('dbs', ['Local', 'Preview'])).toBe('dbs  -  Local  -  Preview');
		expect(theme.banner('PRODUCTION WRITE', ['scope: schema'])).toBe(
			'==== PRODUCTION WRITE ====\n  scope: schema',
		);
		expect(theme.rule(5)).toBe('-----');
	});

	it('aligns summaries by visible width', () => {
		const theme = createTheme({ env: { FORCE_COLOR: '1' }, streams: tty, platform: 'linux' });
		const summary = stripAnsi(
			theme.summary('Summary', [
				['Invitation', 'victoria-y-roberto'],
				['Next', theme.ok('Approve Preview')],
			]),
		);
		expect(summary).toBe(
			'Summary\n  Invitation  victoria-y-roberto\n  Next        Approve Preview',
		);
	});

	it('measures and pads ignoring ANSI sequences', () => {
		expect(visibleWidth('\x1b[32mabc\x1b[39m')).toBe(3);
		expect(padVisible('\x1b[32mab\x1b[39m', 4)).toBe('\x1b[32mab\x1b[39m  ');
	});

	it('derives an inquirer theme with the same symbols', () => {
		const theme = createTheme({ env: { NO_COLOR: '1' }, streams: tty, platform: 'linux' });
		const prompt = promptTheme(theme);
		expect(prompt.prefix.done).toBe('✔');
		expect(prompt.icon.cursor).toBe('❯');
		expect(prompt.style.message('m')).toBe('m');
		expect(prompt.style.error('boom')).toBe('✖ boom');
	});
});
