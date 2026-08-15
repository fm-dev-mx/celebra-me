/**
 * Shared operator argv contract for VS Code tasks, pnpm, and domain CLIs.
 * Pure — no I/O, credentials, or mutation authorization.
 *
 * Leading `--` is the pnpm/task end-of-options marker (success). A leftover
 * `--` after that strip is malformed. Pasted `pnpm <script>` prefixes stay errors.
 */

export const OPERATOR_TASK_SCRIPTS = [
	'invitation:release',
	'prod:apply',
	'db:migrate',
	'dbs',
] as const;

export type OperatorTaskScript = (typeof OPERATOR_TASK_SCRIPTS)[number];

export const PASTED_COMMAND_TOKENS = new Set<string>(['pnpm', ...OPERATOR_TASK_SCRIPTS]);

export function normalizeTaskPrompt(input: string): string {
	const trimmed = input.trim();
	if (trimmed === '--') return '';
	if (trimmed.startsWith('-- ')) return trimmed.slice(3).trim();
	return trimmed;
}

export function buildRestrictedTaskCommand(
	script: string,
	promptArgs: string,
	options?: { injectPnpmSeparator?: boolean },
): string {
	const args = normalizeTaskPrompt(promptArgs);
	if (!args) return `pnpm ${script}`;
	if (options?.injectPnpmSeparator) return `pnpm ${script} -- ${args}`;
	return `pnpm ${script} ${args}`;
}

function rejectPastedCommandTokens(args: readonly string[]): void {
	const pasted: string[] = [];
	let index = 0;
	while (index < args.length && PASTED_COMMAND_TOKENS.has(args[index] ?? '')) {
		pasted.push(args[index] ?? '');
		index += 1;
	}
	if (pasted.length === 0) return;
	throw new Error(
		`PASTED_SCRIPT_PREFIX: No repita ${pasted.join(' ')} en esta task. Escriba solo los argumentos.`,
	);
}

export function normalizeOperatorArgv(args: readonly string[]): string[] {
	const stripped = args[0] === '--' ? args.slice(1) : [...args];
	rejectPastedCommandTokens(stripped);
	if (stripped.includes('--')) {
		throw new Error(
			'UNEXPECTED_PNPM_SEPARATOR: Hay un `--` extra entre los argumentos. En la task escriba únicamente las opciones.',
		);
	}
	return stripped;
}
