/**
 * Shared critical Production backup preparation for owner-only operations.
 *
 * Reuses structurally valid coverage inside the bounded RPO, otherwise captures
 * and verifies a new complete DB/Auth/Storage recovery set. No mutation-domain
 * logic belongs here.
 */
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import type { CriticalBackupPurpose } from './backup-manifest.ts';
import {
	assertCriticalBackupStructuralCoverage,
	CRITICAL_BACKUP_RPO_MS,
	evaluateCriticalBackupCoverage,
	formatBackupAge,
	type CriticalBackupCoverage,
	type CriticalBackupCoverageReason,
} from './critical-backup-reuse.ts';
import { runCommand, type CommandResult } from './db-workflow-lib.ts';
import { OperatorError, operatorSymbol, writeHuman } from './operator-cli-ux.ts';

export interface CriticalProductionBackupPreparation {
	manifestPath: string;
	reused: boolean;
	coverage: CriticalBackupCoverage;
}

export interface EnsureCriticalProductionBackupInput {
	prodDbUrl: string;
	purpose: CriticalBackupPurpose;
	planId?: string;
	pendingVersions?: readonly string[];
	maxAgeMs?: number;
	reuseExisting?: boolean;
	retryCommand: string;
	operationLabel: string;
	failureTitle?: string;
	noChangesMessage?: string;
	run?: typeof runCommand;
}

function isCaptureUnstableOutput(result: CommandResult): boolean {
	return /Production changed while the critical backup set was being captured/i.test(
		`${result.stdout}\n${result.stderr}`,
	);
}

function manifestPathFrom(result: CommandResult): string | undefined {
	const match = /CRITICAL_BACKUP_MANIFEST=([^\r\n]+)/.exec(`${result.stdout}\n${result.stderr}`);
	return match?.[1]?.trim();
}

function coverageFailureCode(reason: CriticalBackupCoverageReason): string {
	if (reason === 'expired' || reason === 'no_candidate') return 'BACKUP_COVERAGE_EXPIRED';
	if (reason === 'structural_drift' || reason === 'profile_mismatch') {
		return 'BACKUP_STRUCTURAL_DRIFT';
	}
	if (reason === 'artifact_invalid') return 'BACKUP_ARTIFACT_INVALID';
	if (reason === 'efs_failed') return 'BACKUP_EFS_FAILED';
	if (reason === 'missing_integrity') return 'BACKUP_MISSING_INTEGRITY';
	if (reason === 'project_mismatch') return 'BACKUP_PROJECT_MISMATCH';
	return 'BACKUP_STRUCTURAL_DRIFT';
}

function captureOnce(input: EnsureCriticalProductionBackupInput): CommandResult {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		PROD_DB_URL: input.prodDbUrl,
		CELEBRA_CRITICAL_BACKUP_PURPOSE: input.purpose,
	};
	if (input.planId) env.CELEBRA_CRITICAL_BACKUP_PLAN_ID = input.planId;
	if (input.pendingVersions?.length) {
		env.CELEBRA_CRITICAL_BACKUP_PENDING = input.pendingVersions.join(',');
	}
	return (input.run ?? runCommand)('npx', ['tsx', 'scripts/db/backup-critical-production.ts'], {
		env,
		redact: [input.prodDbUrl],
		throwOnError: false,
		inheritStderr: true,
	});
}

function captureFailure(
	input: EnsureCriticalProductionBackupInput,
	unstable: boolean,
): OperatorError {
	if (unstable) {
		return new OperatorError({
			title: 'Captura de respaldo crítico inestable',
			cause: 'Production cambió durante dos capturas consecutivas. No fue posible obtener un punto de recuperación coherente.',
			code: 'BACKUP_CAPTURE_UNSTABLE',
			remediation: [
				'Reintente en una ventana breve de menor tráfico.',
				'Si persiste, use una ventana corta de mantenimiento.',
				'No continúe con la escritura sin respaldo verificado.',
			],
			retryCommand: input.retryCommand,
		});
	}
	return new OperatorError({
		title: input.failureTitle ?? 'Respaldo crítico previo fallido',
		cause: `No fue posible completar el respaldo crítico requerido para ${input.operationLabel}.`,
		code: 'CRITICAL_BACKUP_FAILED',
		remediation: [
			'Revise las credenciales PROD_DB_URL / PROD_SUPABASE_* del propietario.',
			'Reintente el flujo completo; no reutilice una captura incompleta.',
		],
		retryCommand: input.retryCommand,
		noChangesMessage: input.noChangesMessage,
	});
}

function assertCapturedCoverage(
	input: EnsureCriticalProductionBackupInput,
	manifestPath: string,
): CriticalBackupCoverage {
	const coverage = assertCriticalBackupStructuralCoverage({
		prodDbUrl: input.prodDbUrl,
		manifestPath,
		maxAgeMs: input.maxAgeMs ?? CRITICAL_BACKUP_RPO_MS,
	});
	if (!coverage.covered) {
		throw new OperatorError({
			title: 'El respaldo capturado no ofrece cobertura verificable',
			cause: `La captura terminó, pero su cobertura falló con estado ${coverage.reason}.`,
			code: 'BACKUP_COVERAGE_INVALID',
			remediation: [
				'Revise la integridad de los artefactos y el cifrado EFS.',
				'Reintente el flujo para obtener un respaldo nuevo.',
			],
			retryCommand: input.retryCommand,
			affected: coverage.failures
				? { label: 'Detalles', items: coverage.failures }
				: undefined,
		});
	}
	return coverage;
}

/**
 * Ensure one verified critical recovery point for the current Production state.
 * Capture is retried at most once when concurrent traffic makes it unstable.
 */
export function ensureCriticalProductionBackup(
	input: EnsureCriticalProductionBackupInput,
): CriticalProductionBackupPreparation {
	const maxAgeMs = input.maxAgeMs ?? CRITICAL_BACKUP_RPO_MS;
	if (input.reuseExisting !== false) {
		writeHuman(`${operatorSymbol('info')} Cobertura: evaluando respaldo crítico vigente…`);
		const current = evaluateCriticalBackupCoverage({
			prodDbUrl: input.prodDbUrl,
			projectRef: SUPABASE_PROJECT_REFS.production,
			maxAgeMs,
		});
		if (current.covered && current.manifestPath) {
			writeHuman(
				`${operatorSymbol('ok')} Respaldo vigente reutilizado · edad ${formatBackupAge(
					current.ageMs ?? 0,
				)} · RPO máximo ${formatBackupAge(current.maxAgeMs)}`,
			);
			if (current.businessActivityDetected) {
				writeHuman(
					`${operatorSymbol('info')} Actividad de negocio posterior al respaldo: permitida dentro del RPO`,
				);
			}
			return { manifestPath: current.manifestPath, reused: true, coverage: current };
		}
		writeHuman(
			`${operatorSymbol('info')} Respaldo vencido o estructuralmente incompatible; creando uno nuevo…`,
		);
	}

	writeHuman(`${operatorSymbol('info')} Cobertura: creando respaldo crítico verificado…`);
	let result = captureOnce(input);
	if (result.status !== 0 && isCaptureUnstableOutput(result)) {
		writeHuman(
			`${operatorSymbol('warn')} Captura inestable por actividad concurrente; reintentando una vez…`,
		);
		result = captureOnce(input);
	}
	if (result.status !== 0) {
		throw captureFailure(input, isCaptureUnstableOutput(result));
	}
	const manifestPath = manifestPathFrom(result);
	if (!manifestPath) {
		throw new OperatorError({
			title: 'No se pudo identificar el respaldo crítico',
			cause: 'La captura terminó sin publicar la ruta de su manifiesto verificado.',
			code: 'BACKUP_MANIFEST_MISSING',
			remediation: [
				'No continúe con la escritura.',
				'Reintente el flujo completo para generar evidencia trazable.',
			],
			retryCommand: input.retryCommand,
		});
	}
	const coverage = assertCapturedCoverage(input, manifestPath);
	writeHuman(`${operatorSymbol('ok')} Respaldo crítico verificado.`);
	return { manifestPath, reused: false, coverage };
}

export function revalidateCriticalProductionBackup(input: {
	prodDbUrl: string;
	manifestPath: string;
	maxAgeMs?: number;
	retryCommand: string;
}): CriticalBackupCoverage {
	writeHuman(
		`${operatorSymbol('info')} Autorización: confirmando cobertura estructural del respaldo…`,
	);
	const coverage = assertCriticalBackupStructuralCoverage({
		prodDbUrl: input.prodDbUrl,
		manifestPath: input.manifestPath,
		maxAgeMs: input.maxAgeMs ?? CRITICAL_BACKUP_RPO_MS,
	});
	if (!coverage.covered) {
		throw new OperatorError({
			title: 'La cobertura del respaldo dejó de ser válida',
			cause: `El respaldo seleccionado ya no cumple el contrato (${coverage.reason}).`,
			code: coverageFailureCode(coverage.reason),
			remediation: [
				'Reinicie el flujo para renovar la cobertura automáticamente.',
				'No reutilice un plan anterior si cambió el schema o el perfil de recuperación.',
			],
			retryCommand: input.retryCommand,
			affected: coverage.failures
				? { label: 'Detalles', items: coverage.failures }
				: undefined,
		});
	}
	if (coverage.businessActivityDetected) {
		writeHuman(
			`${operatorSymbol('info')} Actividad de negocio posterior al respaldo: permitida dentro del RPO`,
		);
	}
	writeHuman(`${operatorSymbol('ok')} Cobertura estructural confirmada.`);
	return coverage;
}
