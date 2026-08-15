import { describe, expect, it } from '@jest/globals';
import {
	displayOperatorCommand,
	operatorCommandCopyValue,
	operatorCommandWriteLabel,
} from '@/lib/status/operator-command-display';

describe('displayOperatorCommand', () => {
	it('shows Preview apply as invitation:release task args', () => {
		const command = 'pnpm invitation:release -- --slug renata --targets preview --apply';
		const display = displayOperatorCommand(command);
		expect(display).toEqual({
			task: 'invitation:release',
			prompt: '--slug renata --targets preview --apply',
			keepFullCommand: false,
			surface: 'task',
			envAssignment: null,
		});
		expect(operatorCommandCopyValue(display)).toBe('--slug renata --targets preview --apply');
	});

	it('keeps Local apply as task prompt args', () => {
		expect(
			displayOperatorCommand(
				'pnpm invitation:release -- --slug renata --targets local --apply',
			),
		).toEqual({
			task: 'invitation:release',
			prompt: '--slug renata --targets local --apply',
			keepFullCommand: false,
			surface: 'task',
			envAssignment: null,
		});
	});

	it('splits invitation:release dry-run and approve', () => {
		expect(
			displayOperatorCommand(
				'pnpm invitation:release -- --slug renata --targets preview --dry-run',
			).prompt,
		).toBe('--slug renata --targets preview --dry-run');
		expect(
			displayOperatorCommand('pnpm invitation:release -- --package-hash abc123 --approve')
				.prompt,
		).toBe('--package-hash abc123 --approve');
	});

	it('does not add a leading pnpm separator to Local invitation:release flags', () => {
		expect(
			displayOperatorCommand('pnpm invitation:release --slug renata --targets local --apply')
				.prompt,
		).toBe('--slug renata --targets local --apply');
	});

	it('shows Preview schema apply with the migrate task scope', () => {
		const command = 'pnpm db:migrate -- --target preview --apply';
		const display = displayOperatorCommand(command);
		expect(display.surface).toBe('terminal');
		expect(display.envAssignment).toBe('$env:CELEBRA_TASK_SCOPE="preview:schema:migrate"');
		expect(display.prompt).toBe(command);
	});

	it('splits prod:apply plan and patch apply', () => {
		expect(displayOperatorCommand('pnpm prod:apply -- --slug leslie-perez')).toEqual({
			task: 'prod:apply',
			prompt: '--slug leslie-perez',
			keepFullCommand: false,
			surface: 'task',
			envAssignment: null,
		});
		expect(
			displayOperatorCommand(
				'pnpm prod:apply -- --patch scripts/manual/production-patches/example.sql --owner-user-id <uuid> --apply',
			).prompt,
		).toBe(
			'--patch scripts/manual/production-patches/example.sql --owner-user-id <uuid> --apply',
		);
	});

	it('splits db:migrate targets', () => {
		expect(displayOperatorCommand('pnpm db:migrate -- --target preview').prompt).toBe(
			'--target preview',
		);
		expect(
			displayOperatorCommand('pnpm db:migrate -- --target disposable-test --apply').prompt,
		).toBe('--target disposable-test --apply');
	});

	it('keeps dbs positional args and diagnostics without repeating the script', () => {
		expect(displayOperatorCommand('pnpm dbs')).toEqual({
			task: 'dbs',
			prompt: '',
			keepFullCommand: false,
			surface: 'task',
			envAssignment: null,
		});
		expect(operatorCommandWriteLabel(displayOperatorCommand('pnpm dbs'))).toBe('(Enter)');
		expect(operatorCommandCopyValue(displayOperatorCommand('pnpm dbs'))).toBe('');
		expect(displayOperatorCommand('pnpm dbs --diagnostics').prompt).toBe('--diagnostics');
		expect(displayOperatorCommand('pnpm dbs -- --diagnostics').prompt).toBe('--diagnostics');
		expect(displayOperatorCommand('pnpm dbs renata').prompt).toBe('renata');
	});

	it('keeps full commands for scripts without a dedicated task', () => {
		const parity = 'pnpm invitation:content-parity -- --slug renata --event-type xv';
		const identity = 'pnpm invitation:diagnose-identity -- --target preview';
		const patch = 'pnpm db:prod:patch -- --dry-run --file scripts/manual/example.sql';
		for (const command of [parity, identity, patch]) {
			expect(displayOperatorCommand(command)).toEqual({
				task: null,
				prompt: command,
				keepFullCommand: true,
				surface: 'terminal',
				envAssignment: null,
			});
			expect(operatorCommandCopyValue(displayOperatorCommand(command))).toBe(command);
		}
	});

	it('does not invent flags or rewrite unknown text', () => {
		expect(displayOperatorCommand('manual review')).toEqual({
			task: null,
			prompt: 'manual review',
			keepFullCommand: true,
			surface: 'terminal',
			envAssignment: null,
		});
		expect(
			displayOperatorCommand(
				'pnpm invitation:release -- --slug renata --targets preview --apply',
			).prompt,
		).not.toContain('--unknown');
	});
});
