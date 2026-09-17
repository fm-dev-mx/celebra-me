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
	const commands = [
		'pnpm invitation:release -- --package-hash 3c0a950f373076b76ff40336b7d65f508f9d65c380508fcab92e763586390a1b --approve',
		'pnpm prod:apply -- --patch scripts/manual/production-patches/20260812_thankyou_editorial_back_cover_structural_contracts.sql --apply',
		'pnpm invitation:release -- --slug abril-michelle-becerra-rea --targets preview --dry-run',
	];
	const command = commands[0];

	it('keeps redirected output canonical and single-line', () => {
		expect(
			formatOperatorCommandLines(command, {
				columns: 80,
				platform: 'win32',
				isTTY: false,
			}),
		).toEqual([`     ${command}`]);
	});

	it('caps a 120-column PowerShell TTY at the conservative width', () => {
		for (const value of commands) {
			const lines = formatOperatorCommandLines(value, {
				columns: 120,
				platform: 'win32',
				isTTY: true,
			});
			expect(lines.length).toBeGreaterThan(1);
			expect(lines.slice(0, -1).every((line) => line.endsWith(' `'))).toBe(true);
			expect(reconstruct(lines, '`')).toBe(value);
		}
	});

	it('uses POSIX continuations without splitting tokens', () => {
		const lines = formatOperatorCommandLines(command, {
			columns: 120,
			platform: 'linux',
			isTTY: true,
		});
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.slice(0, -1).every((line) => line.endsWith(' \\'))).toBe(true);
		expect(reconstruct(lines, '\\')).toBe(command);
	});
});
