/**
 * Presentation-only split of canonical `pnpm <script> -- <args>` strings into
 * VS Code task prompt args. Does not rewrite stored applyCommand / step.command.
 *
 * invitation:release Preview apply uses the operator task, which binds
 * CELEBRA_OPERATOR_TASK so the CLI can mint preview:<slug>:<operation>.
 * db:migrate Preview apply stays in terminal form with CELEBRA_TASK_SCOPE
 * (that task is still piped).
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

export const PREVIEW_MIGRATE_TASK_SCOPE = 'preview:schema:migrate';

/**
 * Shell statement that sets an environment variable for the following command line.
 * Defaults to PowerShell (the operator console); pass the host platform from CLIs.
 */
export function formatEnvAssignment(
	name: string,
	value: string,
	platform: NodeJS.Platform = 'win32',
): string {
	return platform === 'win32' ? `$env:${name}="${value}"` : `export ${name}="${value}"`;
}

function previewMigrateScope(args: string, platform: NodeJS.Platform): string | null {
	if (!hasFlag(args, '--apply')) return null;
	if (flagFromArgs(args, '--target') !== 'preview') return null;
	return formatEnvAssignment('CELEBRA_TASK_SCOPE', PREVIEW_MIGRATE_TASK_SCOPE, platform);
}

function previewWriteScope(script: string, rest: string, platform: NodeJS.Platform): string | null {
	if (script !== 'db:migrate') return null;
	return previewMigrateScope(stripPnpmSeparator(rest), platform);
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

export function displayOperatorCommand(
	command: string,
	options: { platform?: NodeJS.Platform } = {},
): OperatorCommandDisplay {
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
	const envAssignment = previewWriteScope(script, rest, options.platform ?? 'win32');
	if (envAssignment) {
		return terminalCommand(trimmed, envAssignment);
	}
	return {
		task: script,
		prompt: stripPnpmSeparator(rest),
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
