/**
 * Brief operator guidance for invitation:release mistakes.
 * Presentation only — does not accept malformed argv or authorize writes.
 */
import { formatOperatorFailure, type OperatorFailureInput } from '../db/operator-cli-ux.ts';

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

export function invitationFailureGuidance(
	reason: string,
	invitation?: string,
	environment?: string,
): OperatorFailureInput | null {
	const slug = invitation && invitation !== 'no especificada' ? invitation : '<slug>';
	const target = environment?.split(',')[0]?.trim() || 'preview';

	if (reason.includes('PASTED_SCRIPT_PREFIX')) {
		return {
			title: 'No repita el nombre del comando',
			cause: 'Esta task ya ejecuta el script. Solo se aceptan sus argumentos.',
			code: 'PASTED_SCRIPT_PREFIX',
			remediation: ['En el prompt de la task escriba únicamente los argumentos.'],
			retryCommand: taskPromptRetry(
				slug,
				target === 'preview' || target === 'local' ? target : 'preview',
			),
			noChangesMessage: 'No se escribió nada.',
		};
	}

	if (reason.includes('UNEXPECTED_PNPM_SEPARATOR') || reason.includes('PASTED_PNPM_SEPARATOR')) {
		return {
			title: 'Separador inesperado',
			cause: 'Hay un -- extra entre los argumentos. No es una opción de este CLI.',
			code: 'UNEXPECTED_PNPM_SEPARATOR',
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

export function formatPreviewApplyApprovalGuidance(input: {
	slug: string;
	packageHash: string;
	approvalState?: string;
}): string | null {
	if (input.approvalState === 'approved') {
		return (
			`Preview ya está aprobado (package-hash ${input.packageHash}).\n` +
			'Siguiente: inspeccione Production; use --apply solo si el plan queda READY:\n' +
			`  pnpm prod:apply -- --slug ${input.slug}`
		);
	}
	if (input.approvalState === 'pending_hosted_validation') {
		return (
			`Aprobación Preview pendiente (package-hash ${input.packageHash}).\n` +
			'Verifique y apruebe Preview en vivo; después promueva con el mismo paquete:\n' +
			`  pnpm invitation:release -- --package-hash ${input.packageHash} --approve\n` +
			`  pnpm prod:apply -- --slug ${input.slug}`
		);
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
