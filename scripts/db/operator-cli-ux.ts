/**
 * Shared Production / schema-ops CLI presentation helpers.
 *
 * Human text → stderr. Structured JSON remains the caller's stdout concern.
 * Spanish operator copy; English technical codes; NO_COLOR respected.
 */

export const NO_PRODUCTION_CHANGES = 'No changes were made to Production';

export type OperatorSymbolKind = 'ok' | 'warn' | 'fail' | 'info';

export interface OperatorFailureInput {
	/** Short human title (Spanish). */
	title: string;
	/** Brief cause (Spanish). */
	cause: string;
	/** Stable technical error code (English token). */
	code: string;
	/** Concrete remediation steps (Spanish). */
	remediation: readonly string[];
	/** Exact retry command when known. */
	retryCommand?: string;
	/** Multiline list (dirty files, mismatch causes, etc.). */
	affected?: {
		label: string;
		items: readonly string[];
	};
	/** Override default Production no-write guarantee line. */
	noChangesMessage?: string;
}

function streamIsTty(): boolean {
	return Boolean(process.stderr.isTTY);
}

export function useCliColor(env: NodeJS.ProcessEnv = process.env): boolean {
	if (env.NO_COLOR) return false;
	if (env.FORCE_COLOR === '0') return false;
	return streamIsTty();
}

const ansi = {
	bold: (s: string, color: boolean) => (color ? `\x1b[1m${s}\x1b[0m` : s),
	dim: (s: string, color: boolean) => (color ? `\x1b[2m${s}\x1b[0m` : s),
	red: (s: string, color: boolean) => (color ? `\x1b[31m${s}\x1b[0m` : s),
	green: (s: string, color: boolean) => (color ? `\x1b[32m${s}\x1b[0m` : s),
	yellow: (s: string, color: boolean) => (color ? `\x1b[33m${s}\x1b[0m` : s),
};

/** Semantic symbols that remain readable without color. */
export function operatorSymbol(
	kind: OperatorSymbolKind,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const color = useCliColor(env);
	switch (kind) {
		case 'ok':
			return ansi.green('✓', color);
		case 'warn':
			return ansi.yellow('!', color);
		case 'fail':
			return ansi.red('×', color);
		case 'info':
			return ansi.dim('·', color);
	}
}

export function writeHuman(message = '', env: NodeJS.ProcessEnv = process.env): void {
	void env;
	process.stderr.write(`${message}\n`);
}

export function shortSha(value: string | null | undefined, length = 8): string {
	if (!value) return '(ninguno)';
	const trimmed = value.trim();
	if (trimmed.length <= length) return trimmed;
	return `${trimmed.slice(0, length)}…`;
}

export function formatKeyValueBlock(
	title: string,
	rows: ReadonlyArray<readonly [string, string]>,
	options: { env?: NodeJS.ProcessEnv; width?: number } = {},
): string {
	const env = options.env ?? process.env;
	const color = useCliColor(env);
	const width = options.width ?? 18;
	const lines = [
		'────────────────────────────────────────',
		ansi.bold(title, color),
		'────────────────────────────────────────',
	];
	for (const [label, value] of rows) {
		lines.push(`${label.padEnd(width)} ${value}`);
	}
	lines.push('────────────────────────────────────────');
	return lines.join('\n');
}

export function formatOperatorFailure(
	input: OperatorFailureInput,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const color = useCliColor(env);
	const mark = operatorSymbol('fail', env);
	const lines: string[] = [
		'',
		`${mark} ${ansi.bold(input.title, color)}`,
		'',
		`Causa: ${input.cause}`,
		'',
		input.noChangesMessage ?? NO_PRODUCTION_CHANGES,
		'',
		ansi.bold('Remediación:', color),
	];
	input.remediation.forEach((step, index) => {
		lines.push(`  ${index + 1}. ${step}`);
	});
	if (input.affected && input.affected.items.length > 0) {
		lines.push('');
		lines.push(`${input.affected.label} (${input.affected.items.length}):`);
		for (const item of input.affected.items) {
			lines.push(`  - ${item}`);
		}
	}
	if (input.retryCommand) {
		lines.push('');
		lines.push(`Reintento: ${input.retryCommand}`);
	}
	lines.push('');
	lines.push(ansi.dim(`Código: ${input.code}`, color));
	lines.push('');
	return lines.join('\n');
}

export function failOperator(
	input: OperatorFailureInput,
	env: NodeJS.ProcessEnv = process.env,
): never {
	process.stderr.write(formatOperatorFailure(input, env));
	process.exit(1);
}

/** Friendly labels for plan enums shown in compact operator views. */
export function labelAuthRequirement(value: string): string {
	switch (value) {
		case 'production_owner_tty':
			return 'Confirmación interactiva del propietario';
		case 'preview_scope_or_tty':
			return 'Alcance Preview o TTY';
		case 'none':
			return 'Ninguna';
		default:
			return value;
	}
}

export function labelBackupRequirement(value: string): string {
	switch (value) {
		case 'prod_critical_pre_post':
			return 'Respaldo crítico antes y después';
		case 'none':
			return 'Ninguno';
		default:
			return value;
	}
}

export function labelCompatibility(value: string): string {
	switch (value) {
		case 'allow':
			return 'Compatible';
		case 'block':
			return 'Bloqueado';
		case 'environment_not_ready':
			return 'Entorno no listo';
		default:
			return value;
	}
}

export function labelTarget(value: string): string {
	switch (value) {
		case 'production':
			return 'Production';
		case 'preview':
			return 'Preview';
		case 'local':
			return 'Local';
		case 'disposable-test':
			return 'Disposable test';
		default:
			return value;
	}
}

export function formatPhaseSummary(
	phaseByVersion: Readonly<Record<string, string>>,
	pendingVersions: readonly string[],
): string {
	if (pendingVersions.length === 0) return '(ninguna)';
	return pendingVersions
		.map((version) => {
			const phase = phaseByVersion[version] ?? 'unspecified';
			return `${version} (${phase})`;
		})
		.join(', ');
}

/**
 * Parse `git status --porcelain` into stable path labels for operator lists.
 */
export function parsePorcelainDirtyFiles(porcelain: string, limit = 24): string[] {
	const lines = porcelain
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter(Boolean);
	return lines.slice(0, limit).map((line) => {
		// XY PATH or XY ORIG -> PATH
		const renamed = line.match(/^.. (.+) -> (.+)$/);
		if (renamed) return `${renamed[1]} → ${renamed[2]}`;
		return line.slice(3);
	});
}
