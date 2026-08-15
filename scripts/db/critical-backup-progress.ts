/** Operator-visible phases for a critical Production backup capture. */

export const BACKUP_PHASE_LABELS = {
	integrityBefore: 'integridad previa',
	dumpPublic: 'pg_dump public',
	auth: 'volcado auth',
	storageMetadata: 'metadatos Storage',
	storageObjects: 'objetos Storage',
	integrityAfter: 'integridad posterior',
	manifest: 'manifiesto',
} as const;

export function formatBackupPhase(phase: string, detail?: string): string {
	return detail ? `Respaldo: ${phase} · ${detail}` : `Respaldo: ${phase}`;
}

export function writeBackupPhase(phase: string, detail?: string): void {
	process.stderr.write(`${formatBackupPhase(phase, detail)}\n`);
}

