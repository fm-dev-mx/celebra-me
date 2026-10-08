/**
 * Read-only reports shared by the invitation:release CLI flags and its interactive menu:
 * local inventory status (--status) and Preview provenance receipt diagnosis text.
 */
import { LOCAL_DB_URL } from '../db/db-target-config.ts';
import { evaluateInvitationReadiness } from './invitation-readiness.ts';
import { readFastInvitationInventory } from './invitation-status-inventory.ts';
import { buildStatusReport, type InvitationUpdateTarget } from './invitation-update-options.ts';
import { formatStatusReport, type StatusReportData } from './invitation-update-presenter.ts';
import type { inspectPreviewProvenanceReceipt } from './preview-provenance-receipt-service.ts';

export interface StatusReportRequest {
	slug?: string;
	targets: InvitationUpdateTarget[];
	includeUnmanaged?: boolean;
	includeArchived?: boolean;
	includeDemos?: boolean;
	json?: boolean;
}

/** Local inventory status; remotes are never probed here (use pnpm dbs for the matrix). */
export async function printStatusReport(request: StatusReportRequest): Promise<void> {
	const { slug, targets } = request;
	const report = buildStatusReport({
		slug,
		targets: targets.length > 0 ? targets : undefined,
		includeUnmanaged: request.includeUnmanaged,
		includeArchived: request.includeArchived,
		includeDemos: request.includeDemos,
	}) as StatusReportData & Record<string, unknown>;

	if (targets.includes('local')) {
		// Archived definitions excluded from the report are not probed either.
		const definitionSlugs = slug ? [slug] : report.definitions.map((d) => d.slug);
		const fastInventory = readFastInvitationInventory(LOCAL_DB_URL, definitionSlugs, slug);
		report.inventory = { local: fastInventory };

		if (fastInventory.verified) {
			for (const def of report.definitions) {
				const match = fastInventory.rows.find((r) => r.slug === def.slug);
				if (match) {
					def.environments.local = {
						status: match.status,
						managedStatus:
							match.status === 'MANAGED' ? 'MANAGED' : 'UNAPPLIED_DEFINITION',
						syncStatus: 'UNEVALUATED',
						reason:
							match.status === 'MANAGED'
								? 'Persistent-local database record and release provenance verified.'
								: 'Persistent-local database record exists but lacks provenance.',
					};
					if (targets.length === 1 && targets[0] === 'local') {
						def.classification = match.status;
					}
				}
			}
		}

		if (slug) {
			try {
				report.readiness = await evaluateInvitationReadiness({ slug });
			} catch {
				// Readiness check failure is captured in inventory report without crashing status.
			}
		}
	}

	if (request.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(formatStatusReport(report));
	}
}

export function formatPreviewReceiptDiagnosis(
	result: Awaited<ReturnType<typeof inspectPreviewProvenanceReceipt>>,
): string {
	const shortHash = (value: string | null): string => (value ? `${value.slice(0, 12)}…` : 'n/a');
	const lines = [
		`Diagnóstico de receipts Preview: ${result.status}.`,
		`· Clasificación: ${result.classification} · código: ${result.reasonCode}.`,
		`· Operación vinculada: ${result.linkedOperationId ?? 'ninguna'}.`,
		`· Última operación: ${result.latestOperationId ?? 'ninguna'}.`,
		`· Estado receipts: linked ${result.receipts.linked?.status ?? 'ninguno'} · latest ${result.receipts.latest?.status ?? 'ninguno'}.`,
		`· Pasos latest: ${result.completedSteps.latest.join(', ') || 'ninguno'}.`,
		`· Paridad contenido: draft ${result.parity.content.draft ? 'OK' : 'FALLO'}, publicación ${result.parity.content.publication ? 'OK' : 'FALLO'}, provenance ${result.parity.content.managedProjection ? 'OK' : 'FALLO'}.`,
		`· Paridad assets metadata: ${result.parity.assets ? 'OK' : 'FALLO'} (sin descargas ni Storage).`,
		`· Hashes comparables: publicación ${shortHash(result.parity.comparableHashes.currentPublication)}, draft ${shortHash(result.parity.comparableHashes.currentDraft)}, assets ${shortHash(result.parity.comparableHashes.currentAssetMetadata)}.`,
		`· Escrituras previstas: contenido 0 · Storage 0 · metadata ${result.writes.metadata}.`,
		`· ${result.message}`,
		`· Siguiente paso: ${result.nextAction}`,
	];
	if (result.blockers.length > 0) lines.push(`· Bloqueos: ${result.blockers.join(', ')}.`);
	return lines.join('\n');
}
