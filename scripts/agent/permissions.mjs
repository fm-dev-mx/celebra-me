/** Native approval adapters. These reduce prompts; they never grant task authority. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const POLICY = new URL('../../.agent/permissions/policy.json', import.meta.url);
const BEGIN = '# BEGIN celebra-me permissions';
const END = '# END celebra-me permissions';
const TARGETS = {
	codex: '.codex/rules/celebra-me.rules',
	claude: '.claude/settings.json',
	gemini: '.gemini/policies/celebra-me.toml',
	antigravity: '.gemini/antigravity-cli/settings.json',
};

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = (values) => [...new Set(values)];
const quoted = (value) => JSON.stringify(value);
const regexEscape = (value) => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const globRegex = (value) => value.split('*').map(regexEscape).join('.*');

export function validatePolicy(policy) {
	if (!object(policy) || policy.version !== 1) throw new Error('Unsupported permission policy');
	for (const key of ['allow', 'deny', 'denyRead']) {
		if (
			!Array.isArray(policy[key]) ||
			!policy[key].length ||
			policy[key].some(
				(value) =>
					typeof value !== 'string' ||
					!value ||
					value.trim() !== value ||
					[...value].some((character) => character.charCodeAt(0) < 32) ||
					/["'`;|&<>]/.test(value) ||
					/(?:[A-Za-z]:[\\/]|^\/|\.\.)/.test(value),
			)
		)
			throw new Error(`Invalid policy list: ${key}`);
	}
	if (policy.allow.some((command) => !/^[\w.:/ -]+$/.test(command))) {
		throw new Error('Allow entries must be literal command prefixes');
	}
	return policy;
}

const shellPattern = (command) => `${command}${command.endsWith('*') ? '' : ' *'}`;
// Gemini prepends `"command":"` before compiling this regex against serialized tool arguments.
// Allow only simple literal argv; shell composition/substitution keeps the host's approval gate.
const geminiAllow = (command) => `${regexEscape(command)}(?: [A-Za-z0-9_./:=,@%+\\-]+)*"`;
const geminiDeny = (command) => `${globRegex(command)}(?:\\s|")`;

/** Compile only documented native fields; unsupported coverage is returned explicitly. */
export function compilePolicy(input) {
	const policy = validatePolicy(input);
	const codex = [
		...policy.allow.map((s) => [s, 'allow']),
		...policy.deny.filter((s) => !s.includes('*')).map((s) => [s, 'forbidden']),
	].map(
		([command, decision]) =>
			`prefix_rule(pattern=${quoted(command.split(' '))}, decision=${quoted(decision)})`,
	);
	const commands = (decision) =>
		policy[decision].flatMap((command) =>
			['Bash', 'PowerShell'].map((tool) => `${tool}(${shellPattern(command)})`),
		);
	const claude = {
		allow: commands('allow'),
		deny: [...commands('deny'), ...policy.denyRead.map((glob) => `Read(${glob})`)],
	};
	const rule = (fields, decision, priority) =>
		[
			'[[rule]]',
			...Object.entries(fields).map(([k, v]) => `${k} = ${quoted(v)}`),
			`decision = ${quoted(decision)}`,
			`priority = ${priority}`,
			'',
		].join('\n');
	const gemini = [
		...policy.allow.map((command) =>
			rule(
				{ toolName: 'run_shell_command', commandRegex: geminiAllow(command) },
				'allow',
				10,
			),
		),
		...policy.deny.map((command) =>
			rule({ toolName: 'run_shell_command', commandRegex: geminiDeny(command) }, 'deny', 999),
		),
		rule(
			{
				toolName: ['read_file', 'read_many_files', 'search_file_content', 'glob'],
				argsPattern: policy.denyRead
					.map((glob) => globRegex(glob.replace(/^\*\*\//, '').replace(/\/\*\*$/, '')))
					.join('|'),
			},
			'deny',
			999,
		),
	];
	const antigravity = {
		allow: policy.allow.map((command) => `command(${command})`),
		deny: [
			...policy.deny.map((command) =>
				command.includes('*')
					? `command(regex:${globRegex(command)})`
					: `command(${command})`,
			),
			...policy.denyRead.map(
				(glob) =>
					`read_file(${glob
						.replace(/^\*\*\//, '')
						.replace(/\*\*$/, '')
						.replace(/\*$/, '')})`,
			),
		],
	};
	return { codex: codex.join('\n') + '\n', claude, gemini: gemini.join('\n'), antigravity };
}

function managedText(before, generated) {
	const block = `${BEGIN}\n${generated.trimEnd()}\n${END}\n`;
	const start = before.indexOf(BEGIN);
	const end = before.indexOf(END);
	if (start < 0 && end < 0)
		return before + (before && !before.endsWith('\n') ? '\n' : '') + block;
	if (
		start < 0 ||
		end < start ||
		before.indexOf(BEGIN, start + BEGIN.length) >= 0 ||
		before.indexOf(END, end + END.length) >= 0
	)
		throw new Error('Invalid managed block');
	const after =
		end +
		END.length +
		(before[end + END.length] === '\r' ? 2 : before[end + END.length] === '\n' ? 1 : 0);
	return before.slice(0, start) + block + before.slice(after);
}

function mergePermissions(before, generated) {
	let settings;
	try {
		settings = before ? JSON.parse(before) : {};
	} catch {
		throw new Error('Invalid settings JSON (contents withheld)');
	}
	if (
		!object(settings) ||
		(settings.permissions !== undefined && !object(settings.permissions))
	) {
		throw new Error('Invalid permissions object (contents withheld)');
	}
	const permissions = settings.permissions ?? {};
	const added = {};
	for (const key of ['allow', 'deny']) {
		const current = permissions[key] ?? [];
		if (!Array.isArray(current) || current.some((s) => typeof s !== 'string')) {
			throw new Error(`Invalid permissions.${key} (contents withheld)`);
		}
		added[key] = generated[key].filter((s) => !current.includes(s));
		permissions[key] = unique([...current, ...generated[key]]);
	}
	if (!added.allow.length && !added.deny.length) return { after: before, added };
	settings.permissions = permissions;
	return { after: JSON.stringify(settings, null, 2) + '\n', added };
}

/** Never follow links/junctions, including parent directories, into another configuration. */
function safeTarget(home, relative) {
	let target = path.resolve(home);
	for (const part of ['', ...relative.split('/')]) {
		target = path.join(target, part);
		if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
			throw new Error(`Linked configuration refused: ${relative}`);
		}
	}
	if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) {
		throw new Error(`Configuration is not a regular file: ${relative}`);
	}
	return target;
}

export function planPermissions({
	home = os.homedir(),
	policy = JSON.parse(fs.readFileSync(POLICY, 'utf8')),
} = {}) {
	const compiled = compilePolicy(policy);
	return Object.entries(TARGETS).map(([adapter, relative]) => {
		const target = safeTarget(home, relative);
		const exists = fs.existsSync(target);
		const before = exists ? fs.readFileSync(target, 'utf8') : '';
		if (adapter === 'codex' || adapter === 'gemini') {
			const after = managedText(before, compiled[adapter]);
			return {
				adapter,
				relative,
				target,
				exists,
				before,
				after,
				additions: [compiled[adapter].trimEnd()],
			};
		}
		const { after, added } = mergePermissions(before, compiled[adapter]);
		return {
			adapter,
			relative,
			target,
			exists,
			before,
			after,
			additions: Object.entries(added).flatMap(([key, values]) =>
				values.map((value) => `permissions.${key} += ${quoted(value)}`),
			),
		};
	});
}

/** Output generated permissions only: never serialize old settings, env, tokens or old rules. */
export function permissionDiff(plans) {
	return plans
		.filter((p) => p.before !== p.after)
		.map((p) =>
			[
				`--- ~/${p.relative}`,
				`+++ ~/${p.relative}`,
				'@@ generated permissions; existing values withheld @@',
				...p.additions.flatMap((s) => s.split('\n').map((line) => `+${line}`)),
			].join('\n'),
		)
		.join('\n');
}

export function applyPermissions(plans, home = os.homedir()) {
	const changed = plans.filter((p) => p.before !== p.after);
	const verify = (p) => {
		const target = safeTarget(home, p.relative);
		if (
			target !== p.target ||
			fs.existsSync(target) !== p.exists ||
			(p.exists && fs.readFileSync(target, 'utf8') !== p.before)
		) {
			throw new Error(`Configuration changed since planning: ${p.relative}`);
		}
	};
	changed.forEach(verify);
	// Complete all backups before writing the first configuration. Never overwrite a backup.
	const suffix = `.celebra-backup-${Date.now()}-${randomUUID()}`;
	for (const p of changed) {
		if (p.exists) fs.writeFileSync(p.target + suffix, p.before, { flag: 'wx', mode: 0o600 });
	}
	for (const p of changed) {
		verify(p);
		fs.mkdirSync(path.dirname(p.target), { recursive: true });
		const temporary = p.target + `.celebra-write-${randomUUID()}`;
		try {
			fs.writeFileSync(temporary, p.after, { flag: 'wx', mode: 0o600 });
			fs.renameSync(temporary, p.target);
		} finally {
			if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
		}
	}
	return changed.length;
}

export function main(args = process.argv.slice(2)) {
	let apply = false;
	let dryRun = false;
	let home = os.homedir();
	for (const arg of args) {
		if (arg === '--') continue;
		if (arg === '--apply') apply = true;
		else if (arg === '--dry-run') dryRun = true;
		else if (arg.startsWith('--home=')) home = path.resolve(arg.slice(7));
		else throw new Error('Unknown permission option');
	}
	if (apply && dryRun) throw new Error('Choose --dry-run or --apply');
	const plans = planPermissions({ home });
	process.stdout.write(permissionDiff(plans) + '\n');
	process.stderr.write(
		'Coverage: Codex literal prefixes only; wildcard denies and file reads require repository policy and sandbox controls.\n' +
			'Coverage: Antigravity CLI only; file denies cover literal workspace paths, not all glob matches; App/IDE is unsupported and unchanged.\n' +
			'Coverage: existing approvals, Ask rules, Gemini priority conflicts, wrappers and indirect script reads are not reconciled.\n',
	);
	if (apply)
		process.stderr.write(
			`Updated ${applyPermissions(plans, home)} configuration(s); backups precede writes.\n`,
		);
	else process.stderr.write('Dry-run: no files or backups written.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		// Do not echo parse errors or user-supplied values: they may contain credentials.
		process.stderr.write(
			`agent:permissions: ${
				error instanceof Error &&
				/^(?:Unsupported permission|Invalid |Allow entries|Missing mandatory|Linked configuration|Configuration |Unknown permission|Choose )/.test(
					error.message,
				)
					? error.message
					: 'Operation failed (contents withheld)'
			}\n`,
		);
		process.exitCode = 1;
	}
}
