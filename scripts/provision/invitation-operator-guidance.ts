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

function taskPromptRetry(slug: string, targets: string): string {
	return `--slug ${slug} --targets ${targets} --apply`;
}

/** Operator-visible PRECONDITION_FAILED class. Does not echo hashes, paths, or credentials. */
export function translatePreconditionFailure(message: string): string | null {
	if (!message.includes('PRECONDITION_FAILED')) return null;
	if (message.includes('package source changed')) {
		return 'El origen del paquete cambió después de confirmar el plan. Genere y confirme un plan nuevo.';
	}
	if (message.includes('resolved package changed')) {
		return 'El paquete resuelto cambió después de confirmar el plan. Genere y confirme un plan nuevo.';
	}
	if (message.includes('draft updated timestamp changed')) {
		return 'El borrador del destino cambió después de confirmar el plan. Genere y confirme un plan nuevo.';
	}
	if (message.includes('published version changed')) {
		return 'La versión publicada del destino cambió después de confirmar el plan. Genere y confirme un plan nuevo.';
	}
	if (
		message.includes('operation set changed') ||
		message.includes('exact target plan produced by preflight')
	) {
		return 'El identificador del plan cambió después de confirmarlo. Genere y confirme un plan nuevo.';
	}
	return 'El origen, el paquete o el estado del destino cambió después de confirmar el plan. Genere y confirme un plan nuevo.';
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
			cause: 'Esta ejecución no es TTY. Use la task invitation:release.',
			code: 'PREVIEW_WRITE_AUTH_REQUIRED',
			remediation: [
				'En el prompt de la task invitation:release escriba únicamente los argumentos.',
			],
			retryCommand: taskPromptRetry(slug, 'preview'),
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
