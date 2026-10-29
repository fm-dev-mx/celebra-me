/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/agent/permissions.mjs');
const homes: string[] = [];
const SECRET = 'private-fixture-value-do-not-print';
function home() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-permissions-'));
	homes.push(dir);
	return dir;
}
function write(dir: string, relative: string, value: string) {
	const file = path.join(dir, relative);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, value);
	return file;
}
function cli(dir: string, ...args: string[]) {
	return runCommand(process.execPath, [SCRIPT, `--home=${dir}`, ...args], {
		cwd: ROOT,
		env: sanitizeEnv({}),
		allowFailure: true,
	});
}
function probe(dir: string, body: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`import * as p from ${JSON.stringify(pathToFileURL(SCRIPT).href)};
        import fs from 'node:fs'; import path from 'node:path';
        const home = process.argv[1];
        const policy = JSON.parse(fs.readFileSync('.agent/permissions/policy.json', 'utf8'));
        ${body}`,
			dir,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(result.stdout);
}
afterEach(() => {
	for (const dir of homes.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('native permission adapters', () => {
	it('defaults to dry-run without creating files or backups', () => {
		const dir = path.join(home(), 'missing');
		const result = cli(dir);
		expect(result.status).toBe(0);
		expect(result.stderr).toContain('Dry-run: no files or backups written');
		expect(result.stdout).toContain('+++ ~/.codex/rules/celebra-me.rules');
		expect(fs.existsSync(dir)).toBe(false);
	});

	it('preserves user settings and Ask, backs up before applying, and is idempotent', () => {
		const dir = home();
		const settings = {
			env: { TOKEN: SECRET },
			permissions: {
				allow: [`Bash(echo ${SECRET})`],
				deny: ['Bash(rm *)'],
				ask: ['Bash(git *)'],
			},
			custom: { enabled: true },
		};
		const file = write(dir, '.claude/settings.json', JSON.stringify(settings));
		write(dir, '.gemini/antigravity-cli/settings.json', JSON.stringify(settings));
		const before = fs.readFileSync(file, 'utf8');
		const preview = cli(dir, '--dry-run');
		expect(preview.status).toBe(0);
		expect(preview.stdout + preview.stderr).not.toContain(SECRET);
		expect(fs.readFileSync(file, 'utf8')).toBe(before);
		expect(cli(dir, '--apply').status).toBe(0);
		const after = JSON.parse(fs.readFileSync(file, 'utf8'));
		expect(after.env).toEqual(settings.env);
		expect(after.custom).toEqual(settings.custom);
		expect(after.permissions.ask).toContain(settings.permissions.ask[0]);
		expect(after.permissions.ask).toContain('Bash(gh pr merge *)');
		expect(after.permissions.allow).toContain(settings.permissions.allow[0]);
		expect(after.permissions.deny).toContain('Read(**/.env*)');
		const afterAgy = JSON.parse(
			fs.readFileSync(path.join(dir, '.gemini/antigravity-cli/settings.json'), 'utf8'),
		);
		expect(afterAgy.permissions.ask).toEqual(settings.permissions.ask);
		expect(afterAgy.permissions.deny).toContain('command(gh pr merge)');
		const backups = fs
			.readdirSync(path.dirname(file))
			.filter((s) => s.includes('.celebra-backup-'));
		expect(backups).toHaveLength(1);
		expect(fs.readFileSync(path.join(path.dirname(file), backups[0]), 'utf8')).toBe(before);
		expect(cli(dir).stdout.trim()).toBe('');
		expect(cli(dir, '--apply').stderr).toContain('Updated 0 configuration(s)');
		expect(
			fs.readdirSync(path.dirname(file)).filter((s) => s.includes('.celebra-backup-')),
		).toEqual(backups);
	});

	it('replaces only marked text and leaves default Codex rules untouched', () => {
		const dir = home();
		const original = `# custom ${SECRET}\n`;
		const defaultFile = write(dir, '.codex/rules/default.rules', original);
		write(dir, '.codex/rules/celebra-me.rules', original);
		expect(cli(dir, '--apply').status).toBe(0);
		const output = probe(
			dir,
			`
            const changed = {...policy, allow: policy.allow.filter(s => s !== 'git diff')};
            p.applyPermissions(p.planPermissions({home, policy: changed}), home);
            console.log(JSON.stringify({rules: fs.readFileSync(path.join(home, '.codex/rules/celebra-me.rules'), 'utf8'),
                diff: p.permissionDiff(p.planPermissions({home, policy: changed}))}));`,
		);
		expect(output.rules).toContain(original);
		expect(output.rules).not.toContain('pattern=["git","diff"]');
		expect(output.diff).toBe('');
		expect(fs.readFileSync(defaultFile, 'utf8')).toBe(original);
		expect(output.rules.match(/# BEGIN celebra-me permissions/g)).toHaveLength(1);
	});

	it('fails planning before any writes on malformed JSON without leaking contents', () => {
		const dir = home();
		const file = write(dir, '.claude/settings.json', `{"env":"${SECRET}", bad`);
		const result = cli(dir, '--apply');
		expect(result.status).toBe(1);
		expect(result.stdout + result.stderr).not.toContain(SECRET);
		expect(fs.existsSync(path.join(dir, '.codex'))).toBe(false);
		expect(fs.readdirSync(path.dirname(file))).toEqual(['settings.json']);
	});

	it.each([
		{ permissions: [] },
		{ permissions: { allow: 'all' } },
		{ permissions: { deny: [false] } },
	])('refuses invalid permission shapes without overwriting them', (settings) => {
		const dir = home();
		const before = JSON.stringify(settings);
		const file = write(dir, '.claude/settings.json', before);
		expect(cli(dir, '--apply').status).toBe(1);
		expect(fs.readFileSync(file, 'utf8')).toBe(before);
	});

	it('refuses incomplete managed blocks and stale plans', () => {
		const dir = home();
		write(dir, '.codex/rules/celebra-me.rules', '# BEGIN celebra-me permissions\n');
		expect(cli(dir, '--apply').status).toBe(1);
		const out = probe(
			home(),
			`
            const plans = p.planPermissions({home});
            fs.mkdirSync(path.join(home, '.claude'), {recursive:true});
            fs.writeFileSync(path.join(home, '.claude/settings.json'), '{}');
            let error = '';
            try { p.applyPermissions(plans, home); } catch (e) { error = e.message; }
            console.log(JSON.stringify({error, wrote: fs.existsSync(path.join(home, '.codex'))}));`,
		);
		expect(out.error).toContain('changed since planning');
		expect(out.wrote).toBe(false);
	});

	it('refuses parent directory junctions/symlinks', () => {
		const dir = home();
		const external = home();
		fs.symlinkSync(
			external,
			path.join(dir, '.claude'),
			process.platform === 'win32' ? 'junction' : 'dir',
		);
		expect(cli(dir, '--apply').stderr).toContain('Linked configuration refused');
		expect(fs.readdirSync(external)).toEqual([]);
	});

	it('rejects contradictory modes, unknown options and policy injection', () => {
		const dir = home();
		expect(cli(dir, '--apply', '--dry-run').status).toBe(1);
		expect(cli(dir, '--unknown').status).toBe(1);
		const out = probe(
			dir,
			`
            const errors = [];
            for (const allow of [['node; echo unsafe'], ['*'], ['git ../other']]) {
                try { p.compilePolicy({...policy, allow}); } catch { errors.push(true); }
            }
            try { p.compilePolicy({...policy, version: 2}); } catch { errors.push(true); }
            console.log(JSON.stringify(errors));`,
		);
		expect(out).toEqual([true, true, true, true]);
	});

	it('matches Gemini serialized arguments, denies hazardous commands, and gates composition', () => {
		const out = probe(
			home(),
			`
            const compiled = p.compilePolicy(policy);
            const rules = compiled.gemini.split('[[rule]]').slice(1).map(block =>
                Object.fromEntries(block.trim().split('\\n').map(line => {
                    const at = line.indexOf(' = '); return [line.slice(0, at), JSON.parse(line.slice(at+3))];
                })));
            function decision(command) {
                const json = JSON.stringify({command});
                const matches = rules.filter(r => r.toolName === 'run_shell_command' &&
                    new RegExp('"command":"' + r.commandRegex).test(json));
                return matches.sort((a,b) => b.priority-a.priority)[0]?.decision ?? 'ask_user';
            }
            console.log(JSON.stringify({
                safe: ['git status --short', 'pnpm test', 'git push origin chore/example'].map(decision),
                blocked: ['git push origin --force', 'git push -u origin HEAD:main', 'gh pr merge 1',
                    'supabase db push --linked', 'pnpm prod:apply -- --apply', 'cat .env.local'].map(decision),
                other: ['pnpm test && arbitrary-command', 'git status $(arbitrary-command)', 'pnpm testing'].map(decision),
                read: rules.filter(r => Array.isArray(r.toolName)).every(r =>
                    new RegExp(r.argsPattern).test(JSON.stringify({file_path: 'nested/.env.local'}))),
                codex: compiled.codex, antigravity: compiled.antigravity, claude: compiled.claude,
            }));`,
		);
		expect(out.safe).toEqual(['allow', 'allow', 'allow']);
		expect(out.blocked).toEqual(Array(6).fill('deny'));
		expect(out.other).toEqual(Array(3).fill('ask_user'));
		expect(out.read).toBe(true);
		expect(out.codex).toContain('pattern=["git","push","origin","main"], decision="forbidden"');
		expect(out.codex).toContain('pattern=["gh","pr","merge"], decision="forbidden"');
		expect(out.codex).not.toContain('pattern=["git","push","*');
		expect(out.antigravity.deny).toContain('command(gh pr merge)');
		expect(out.claude.ask).toContain('Bash(gh pr merge *)');
		expect(out.claude.ask).toContain('PowerShell(gh pr merge *)');
		expect(out.claude.deny).not.toContain('Bash(gh pr merge *)');
	});

	it('moves gh pr merge from deny to ask in Claude settings while Codex and Gemini keep it denied', () => {
		const dir = home();
		const legacySettings = {
			permissions: {
				allow: ['Bash(git status *)'],
				deny: [
					'Bash(git push --force *)',
					'Bash(gh pr merge *)',
					'PowerShell(gh pr merge *)',
					'Bash(gh * pr merge*)',
					'PowerShell(gh * pr merge*)',
				],
			},
		};
		write(dir, '.claude/settings.json', JSON.stringify(legacySettings, null, 2));
		write(dir, '.codex/rules/celebra-me.rules', '');
		write(dir, '.gemini/policies/celebra-me.toml', '');

		// Dry-run should show removals from deny and additions to ask only for Claude
		const preview = cli(dir, '--dry-run');
		expect(preview.status).toBe(0);
		expect(preview.stdout).toContain('--- ~/.claude/settings.json');
		expect(preview.stdout).toContain('-permissions.deny += "Bash(gh pr merge *)"');
		expect(preview.stdout).toContain('-permissions.deny += "PowerShell(gh pr merge *)"');
		expect(preview.stdout).toContain('-permissions.deny += "Bash(gh * pr merge*)"');
		expect(preview.stdout).toContain('-permissions.deny += "PowerShell(gh * pr merge*)"');
		expect(preview.stdout).toContain('+permissions.ask += "Bash(gh pr merge *)"');
		expect(preview.stdout).toContain('+permissions.ask += "PowerShell(gh pr merge *)"');
		expect(preview.stdout).toContain('+permissions.ask += "Bash(gh * pr merge*)"');
		expect(preview.stdout).toContain('+permissions.ask += "PowerShell(gh * pr merge*)"');

		// Apply and verify
		expect(cli(dir, '--apply').status).toBe(0);
		const afterClaude = JSON.parse(
			fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'),
		);
		expect(afterClaude.permissions.deny).not.toContain('Bash(gh pr merge *)');
		expect(afterClaude.permissions.deny).not.toContain('PowerShell(gh pr merge *)');
		expect(afterClaude.permissions.deny).not.toContain('Bash(gh * pr merge*)');
		expect(afterClaude.permissions.deny).not.toContain('PowerShell(gh * pr merge*)');
		expect(afterClaude.permissions.deny).toContain('Bash(git push --force *)');
		expect(afterClaude.permissions.ask).toEqual([
			'Bash(gh pr merge *)',
			'PowerShell(gh pr merge *)',
			'Bash(gh * pr merge*)',
			'PowerShell(gh * pr merge*)',
		]);

		// Codex and Gemini keep gh pr merge denied
		const codexRules = fs.readFileSync(path.join(dir, '.codex/rules/celebra-me.rules'), 'utf8');
		expect(codexRules).toContain(
			'prefix_rule(pattern=["gh","pr","merge"], decision="forbidden")',
		);

		const geminiToml = fs.readFileSync(
			path.join(dir, '.gemini/policies/celebra-me.toml'),
			'utf8',
		);
		expect(geminiToml).toMatch(/commandRegex = "gh pr merge/);
		expect(geminiToml).toMatch(/decision = "deny"/);

		// Second run is idempotent
		expect(cli(dir).stdout.trim()).toBe('');
	});
});
