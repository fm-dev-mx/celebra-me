/**
 * Brief operator guidance for invitation:release mistakes.
 * Presentation only — does not accept malformed argv or authorize writes.
 */
import { formatOperatorFailure, type OperatorFailureInput } from '../db/operator-cli-ux.ts';

const PASTED_COMMAND_TOKENS = new Set([
	'pnpm',
	'invitation:release',
	'prod:apply',
	'db:migrate',
	'dbs',
]);

function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	const next = index >= 0 ? args[index + 1] : undefined;
	if (!next || next.startsWith('-')) return undefined;
	return next;
}

function previewReleaseRetry(slug: string): string {
	return [
		`$env:CELEBRA_TASK_SCOPE="preview:${slug}:apply"`,
		`pnpm invitation:release -- --slug ${slug} --targets preview --apply`,
	].join('\n');
}

function taskPromptRetry(slug: string, targets: string): string {
	return `-- --slug ${slug} --targets ${targets} --apply`;
}

export function rejectPastedCommandPrefix(args: readonly string[]): void {
	const pasted: string[] = [];
	let index = 0;
	while (index < args.length && PASTED_COMMAND_TOKENS.has(args[index] ?? '')) {
		pasted.push(args[index] ?? '');
		index += 1;
	}
	if (pasted.length === 0) return;
	const rest = args.slice(index);
	const slug = flagValue(rest, '--slug') ?? '<slug>';
	const targets = flagValue(rest, '--targets') ?? 'preview';
	throw new Error(
		`PASTED_SCRIPT_PREFIX: No repita ${pasted.join(' ')} en esta task. Escriba solo: ${taskPromptRetry(slug, targets)}`,
	);
}

export function invitationFailureGuidance(
	reason: string,
	invitation?: string,
	environment?: string,
): OperatorFailureInput | null {
	const slug = invitation && invitation !== 'no especificada' ? invitation : '<slug>';
	const target = environment?.split(',')[0]?.trim() || 'preview';

	if (reason.includes('PASTED_SCRIPT_PREFIX') || reason.includes('PASTED_PNPM_SEPARATOR')) {
		const pastedCommand = reason.includes('PASTED_PNPM_SEPARATOR');
		return {
			title: pastedCommand
				? 'No pegue el comando completo'
				: 'No repita el nombre del comando',
			cause: pastedCommand
				? '`--` es el separador de pnpm, no una opción de este CLI.'
				: 'Esta task ya ejecuta el script. Solo se aceptan sus argumentos.',
			code: pastedCommand ? 'PASTED_PNPM_SEPARATOR' : 'PASTED_SCRIPT_PREFIX',
			remediation: ['En el prompt de la task escriba únicamente los argumentos.'],
			retryCommand: taskPromptRetry(
				slug,
				target === 'preview' || target === 'local' ? target : 'preview',
			),
			noChangesMessage: 'No se escribió nada.',
		};
	}

	if (reason.includes('PREVIEW_WRITE_AUTH_REQUIRED')) {
		return {
			title: 'Preview no autorizado',
			cause: 'Esta ejecución no es TTY. El worktree no autoriza la escritura.',
			code: 'PREVIEW_WRITE_AUTH_REQUIRED',
			remediation: [
				'Abra una terminal PowerShell (no esta task).',
				'Defina el alcance y ejecute el comando de reintento.',
			],
			retryCommand: previewReleaseRetry(slug),
			noChangesMessage: 'No se escribió nada.',
		};
	}

	if (reason.startsWith('Opción no reconocida:')) {
		return {
			title: 'Opción no reconocida',
			cause: reason.replace(/^Opción no reconocida:\s*/, ''),
			code: 'UNKNOWN_FLAG',
			remediation: ['Use --help para ver las opciones permitidas.'],
			retryCommand: taskPromptRetry(slug, 'preview'),
			noChangesMessage: 'No se escribió nada.',
		};
	}

	return null;
}

export function formatInvitationGuidance(
	reason: string,
	invitation?: string,
	environment?: string,
): string | null {
	const guidance = invitationFailureGuidance(reason, invitation, environment);
	return guidance ? formatOperatorFailure(guidance) : null;
}
