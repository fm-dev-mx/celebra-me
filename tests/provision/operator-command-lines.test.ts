import { describe, expect, it } from '@jest/globals';
import { formatOperatorCommandLines } from '../../scripts/provision/operator-command-lines';

function reconstruct(lines: string[], marker: '`' | '\\'): string {
	return lines
		.map((line) =>
			line.trim().replace(new RegExp(`\\s*${marker === '`' ? '\\`' : '\\\\'}$`), ''),
		)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

describe('operator command display', () => {
	const command =
		'pnpm invitation:release -- --package-hash 3c0a950f373076b76ff40336b7d65f508f9d65c380508fcab92e763586390a1b --approve';

	it('keeps redirected output canonical and single-line', () => {
		expect(
			formatOperatorCommandLines(command, {
				columns: 80,
				platform: 'win32',
				isTTY: false,
			}),
		).toEqual([`     ${command}`]);
	});

	it('uses PowerShell continuations in an 80-column TTY', () => {
		const lines = formatOperatorCommandLines(command, {
			columns: 80,
			platform: 'win32',
			isTTY: true,
		});
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.slice(0, -1).every((line) => line.endsWith(' `'))).toBe(true);
		expect(reconstruct(lines, '`')).toBe(command);
	});

	it('uses POSIX continuations without splitting tokens', () => {
		const lines = formatOperatorCommandLines(command, {
			columns: 80,
			platform: 'linux',
			isTTY: true,
		});
		expect(lines.slice(0, -1).every((line) => line.endsWith(' \\'))).toBe(true);
		expect(reconstruct(lines, '\\')).toBe(command);
	});
});
