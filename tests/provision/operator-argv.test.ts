import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	buildRestrictedTaskCommand,
	normalizeOperatorArgv,
	normalizeTaskPrompt,
} from '../../scripts/lib/operator-argv.ts';
import { parseMigrateCliArgs } from '../../scripts/db/migrate-cli-args.ts';
import { parseProductionApplyCliArgs } from '../../scripts/db/production-apply-cli-args.ts';
import { checkUnknownFlags } from '../../scripts/provision/invitation-update-options.ts';
import { formatInvitationGuidance } from '../../scripts/provision/invitation-operator-guidance.ts';

const RENATA_PREVIEW_APPLY = ['--slug', 'renata', '--targets', 'preview', '--apply'] as const;

describe('operator argv contract', () => {
	describe('happy paths', () => {
		it('accepts invitation:release task prompt args', () => {
			expect(normalizeOperatorArgv([...RENATA_PREVIEW_APPLY])).toEqual([
				...RENATA_PREVIEW_APPLY,
			]);
		});

		it('consumes a leading pnpm/task separator from invitation:release', () => {
			expect(normalizeOperatorArgv(['--', ...RENATA_PREVIEW_APPLY])).toEqual([
				...RENATA_PREVIEW_APPLY,
			]);
		});

		it('strips a pasted prompt separator before building the task command', () => {
			expect(normalizeTaskPrompt('-- --slug renata --targets preview --apply')).toBe(
				'--slug renata --targets preview --apply',
			);
			expect(
				buildRestrictedTaskCommand(
					'invitation:release',
					'-- --slug renata --targets preview --apply',
					{ injectPnpmSeparator: true },
				),
			).toBe('pnpm invitation:release -- --slug renata --targets preview --apply');
		});

		it('treats Enter and a lone separator as an empty wizard prompt', () => {
			expect(normalizeTaskPrompt('')).toBe('');
			expect(normalizeTaskPrompt('--')).toBe('');
			expect(
				buildRestrictedTaskCommand('invitation:release', '--', {
					injectPnpmSeparator: true,
				}),
			).toBe('pnpm invitation:release');
		});

		it('keeps dry-run, approve, and Local apply as domain args', () => {
			expect(
				normalizeOperatorArgv(['--slug', 'renata', '--targets', 'preview', '--dry-run']),
			).toEqual(['--slug', 'renata', '--targets', 'preview', '--dry-run']);
			expect(normalizeOperatorArgv(['--package-hash', 'abc', '--approve'])).toEqual([
				'--package-hash',
				'abc',
				'--approve',
			]);
			expect(
				normalizeOperatorArgv(['--slug', 'renata', '--targets', 'local', '--apply']),
			).toEqual(['--slug', 'renata', '--targets', 'local', '--apply']);
		});

		it('rebuilds the invitation:release TTY command and parses the forwarded argv', () => {
			const prompt = '--slug renata --targets preview --apply';
			expect(
				buildRestrictedTaskCommand('invitation:release', prompt, {
					injectPnpmSeparator: true,
				}),
			).toBe('pnpm invitation:release -- --slug renata --targets preview --apply');
			expect(normalizeOperatorArgv(['--', ...RENATA_PREVIEW_APPLY])).toEqual([
				...RENATA_PREVIEW_APPLY,
			]);
			expect(() => checkUnknownFlags([...RENATA_PREVIEW_APPLY])).not.toThrow();
		});

		it('parses prod:apply the same with or without a leading separator', () => {
			const without = parseProductionApplyCliArgs([
				'node',
				'production-apply-cli.ts',
				'--slug',
				'leslie-perez',
			]);
			const withSeparator = parseProductionApplyCliArgs([
				'node',
				'production-apply-cli.ts',
				'--',
				'--slug',
				'leslie-perez',
			]);
			expect(withSeparator).toEqual(without);
			expect(without.slugs).toEqual(['leslie-perez']);
			expect(without.apply).toBe(false);
		});

		it('parses db:migrate the same with or without a leading separator', () => {
			const without = parseMigrateCliArgs(['node', 'migrate-cli.ts', '--target', 'preview']);
			const withSeparator = parseMigrateCliArgs([
				'node',
				'migrate-cli.ts',
				'--',
				'--target',
				'preview',
			]);
			expect(withSeparator).toEqual(without);
			expect(without.target).toBe('preview');
			expect(without.mode).toBe('preflight');
		});

		it('keeps dbs empty, diagnostics, slug, and forwarded separator as domain args', () => {
			expect(normalizeOperatorArgv([])).toEqual([]);
			expect(normalizeOperatorArgv(['--diagnostics'])).toEqual(['--diagnostics']);
			expect(normalizeOperatorArgv(['renata'])).toEqual(['renata']);
			expect(normalizeOperatorArgv(['--', '--diagnostics'])).toEqual(['--diagnostics']);
			expect(normalizeOperatorArgv(['--', 'renata'])).toEqual(['renata']);
		});
	});

	describe('sad paths', () => {
		it('rejects a pasted invitation:release command prefix', () => {
			expect(() =>
				normalizeOperatorArgv([
					'pnpm',
					'invitation:release',
					'--',
					...RENATA_PREVIEW_APPLY,
				]),
			).toThrow(/PASTED_SCRIPT_PREFIX/);
			expect(() =>
				normalizeOperatorArgv(['invitation:release', ...RENATA_PREVIEW_APPLY]),
			).toThrow(/PASTED_SCRIPT_PREFIX/);
		});

		it('rejects a missing --slug as an unknown token, not a paste', () => {
			expect(() =>
				checkUnknownFlags(['slug', 'renata', '--targets', 'preview', '--apply']),
			).toThrow(/Opción no reconocida: "slug"/);
			expect(() =>
				checkUnknownFlags(['slug', 'renata', '--targets', 'preview', '--apply']),
			).not.toThrow(/PASTED_|UNEXPECTED_PNPM_SEPARATOR/);
			const text = formatInvitationGuidance(
				'Opción no reconocida: "slug". Use --help para ver las opciones permitidas.',
				'renata',
				'preview',
			);
			expect(text).toContain('UNKNOWN_FLAG');
			expect(text).not.toContain('PASTED_SCRIPT_PREFIX');
			expect(text).not.toContain('pnpm invitation:release');
		});

		it('rejects a leftover separator between flags', () => {
			expect(() =>
				normalizeOperatorArgv(['--slug', 'renata', '--', '--targets', 'preview']),
			).toThrow(/UNEXPECTED_PNPM_SEPARATOR/);
			const text = formatInvitationGuidance(
				'UNEXPECTED_PNPM_SEPARATOR: leftover separator',
				'renata',
				'preview',
			);
			expect(text).toContain('UNEXPECTED_PNPM_SEPARATOR');
			expect(text).toContain('--slug renata --targets preview --apply');
			expect(text).not.toContain('No pegue el comando completo');
			expect(text).not.toContain('pnpm invitation:release');
		});

		it('rejects an unknown invitation:release flag', () => {
			expect(() => checkUnknownFlags(['--please-write'])).toThrow(
				/Opción no reconocida: "--please-write"/,
			);
		});

		it('rejects pasted prod:apply, db:migrate, and dbs prefixes', () => {
			expect(() =>
				normalizeOperatorArgv(['pnpm', 'prod:apply', '--', '--slug', 'x']),
			).toThrow(/PASTED_SCRIPT_PREFIX/);
			expect(() =>
				normalizeOperatorArgv(['pnpm', 'db:migrate', '--', '--target', 'preview']),
			).toThrow(/PASTED_SCRIPT_PREFIX/);
			expect(() => normalizeOperatorArgv(['pnpm', 'dbs', '--diagnostics'])).toThrow(
				/PASTED_SCRIPT_PREFIX/,
			);
		});
	});

	it('keeps task-runner help examples free of a leading prompt separator', () => {
		const source = readFileSync(resolve(process.cwd(), '.vscode/task-runner.ps1'), 'utf8');
		expect(source).toContain('scripts/lib/operator-argv.ts');
		expect(source).not.toContain('Ejemplos: -- --target');
		expect(source).not.toContain('Ejemplos: -- --slug');
		expect(source).toContain('Ejemplos: --target preview');
		expect(source).toContain('Ejemplos: --slug <slug>');
		expect(source).toContain('Ejemplo: --slug <slug> --targets preview --apply');
		expect(source).toContain('Ejemplos: <slug>  |  --diagnostics  |  --help');
	});

	it('marks the invitation:release task so Preview apply can bind operator scope', () => {
		const source = readFileSync(resolve(process.cwd(), '.vscode/task-runner.ps1'), 'utf8');
		expect(source).toContain("$env:CELEBRA_OPERATOR_TASK = 'invitation:release'");
		expect(source).toContain("if ($Command -eq 'invitation:release')");
	});
});
