/**
 * Presentation-only split of canonical `pnpm <script> -- <args>` strings into
 * VS Code task prompt args. Does not rewrite stored applyCommand / step.command.
 *
 * Preview writes cannot run in the piped VS Code task (no TTY, no CELEBRA_TASK_SCOPE).
 * Those commands stay in terminal form with the required scope assignment.
 */

export const OPERATOR_TASK_SCRIPTS = [
	'invitation:release',
	'prod:apply',
	'db:migrate',
	'dbs',
] as const;

export type OperatorTaskScript = (typeof OPERATOR_TASK_SCRIPTS)[number];

export const OPERATOR_ENTER_PROMPT = '(Enter)';

export interface OperatorCommandDisplay {
	task: OperatorTaskScript | null;
	/** Task prompt args, or the original command when keepFullCommand is true. */
	prompt: string;
	keepFullCommand: boolean;
	surface: 'task' | 'terminal';
	envAssignment: string | null;
}

const TASK_SCRIPT_SET = new Set<string>(OPERATOR_TASK_SCRIPTS);
const PNPM_COMMAND_RE = /^pnpm\s+(\S+)(?:\s+([\s\S]*))?$/;

function isOperatorTaskScript(script: string): script is OperatorTaskScript {
	return TASK_SCRIPT_SET.has(script);
}

function stripPnpmSeparator(rest: string): string {
	const trimmed = rest.trim();
	if (trimmed === '--') return '';
	if (trimmed.startsWith('-- ')) return trimmed.slice(3).trim();
	return trimmed;
}

function flagFromArgs(args: string, flag: string): string | undefined {
	const match = new RegExp(`(?:^|\\s)${flag}\\s+([^\\s]+)`).exec(args);
	return match?.[1];
}

function hasFlag(args: string, flag: string): boolean {
	return new RegExp(`(?:^|\\s)${flag}(?:\\s|$)`).test(` ${args} `);
}

function toTaskPrompt(script: OperatorTaskScript, rest: string): string {
	const args = stripPnpmSeparator(rest);
	if (!args) return '';
	if (script === 'dbs') return args;
	return `-- ${args}`;
}

function previewReleaseScope(args: string): string | null {
	if (!hasFlag(args, '--apply') || hasFlag(args, '--dry-run')) return null;
	const targets = (flagFromArgs(args, '--targets') ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
	if (!targets.includes('preview')) return null;
	const slug = flagFromArgs(args, '--slug');
	if (!slug) return null;
	return `$env:CELEBRA_TASK_SCOPE="preview:${slug}:apply"`;
}

function previewMigrateScope(args: string): string | null {
	if (!hasFlag(args, '--apply')) return null;
	if (flagFromArgs(args, '--target') !== 'preview') return null;
	return '$env:CELEBRA_TASK_SCOPE="preview:schema:migrate"';
}

function previewWriteScope(script: string, rest: string): string | null {
	const args = stripPnpmSeparator(rest);
	if (script === 'invitation:release') return previewReleaseScope(args);
	if (script === 'db:migrate') return previewMigrateScope(args);
	return null;
}

function terminalCommand(command: string, envAssignment: string | null): OperatorCommandDisplay {
	return {
		task: null,
		prompt: command,
		keepFullCommand: true,
		surface: 'terminal',
		envAssignment,
	};
}

export function displayOperatorCommand(command: string): OperatorCommandDisplay {
	const trimmed = command.trim();
	const match = PNPM_COMMAND_RE.exec(trimmed);
	if (!match) {
		return terminalCommand(trimmed, null);
	}
	const script = match[1] ?? '';
	const rest = match[2] ?? '';
	if (!isOperatorTaskScript(script)) {
		return terminalCommand(trimmed, null);
	}
	const envAssignment = previewWriteScope(script, rest);
	if (envAssignment) {
		return terminalCommand(trimmed, envAssignment);
	}
	return {
		task: script,
		prompt: toTaskPrompt(script, rest),
		keepFullCommand: false,
		surface: 'task',
		envAssignment: null,
	};
}

export function operatorCommandWriteLabel(display: OperatorCommandDisplay): string {
	if (display.envAssignment) return `${display.envAssignment}\n${display.prompt}`;
	if (display.keepFullCommand) return display.prompt;
	return display.prompt.length > 0 ? display.prompt : OPERATOR_ENTER_PROMPT;
}

export function operatorCommandCopyValue(display: OperatorCommandDisplay): string {
	return operatorCommandWriteLabel(display) === OPERATOR_ENTER_PROMPT
		? display.prompt
		: operatorCommandWriteLabel(display);
}
