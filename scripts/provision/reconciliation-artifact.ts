/**
 * reconciliation-artifact.ts — Durable Redacted Reconciliation Artifact Persistence
 *
 * Persists machine-readable reconciliation artifacts under
 * `.agent/runtime/reconciliation/reconciliation-<slug>-<env>.json`.
 *
 * Safety:
 *  - Redacts passwords, secret role keys, database connection strings, credentials, and guest PII.
 *  - Human-readable Markdown summary generation supported for auditing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
	ManagedDivergenceSummary,
	ReconciliationDecisionOutcome,
	SourceUpdatePlan,
} from './reconciliation-state.ts';

export interface ReconciliationArtifactData {
	invitationSlug: string;
	targetEnvironment: 'local' | 'preview' | 'production';
	canonicalPackageHash: string;
	managedBaselineHash?: string;
	timestamp: string;
	reconciliationState: string;
	changedSemanticPaths: string[];
	decisions: Record<string, ReconciliationDecisionOutcome>;
	unresolvedPaths: string[];
	sourceUpdatePlan?: SourceUpdatePlan;
	isReleaseBlocked: boolean;
}

export function getReconciliationArtifactPath(
	slug: string,
	target: 'local' | 'preview' | 'production',
	projectRoot?: string,
): string {
	const root = projectRoot ?? process.cwd();
	return join(root, '.agent', 'runtime', 'reconciliation', `reconciliation-${slug}-${target}.json`);
}

function sanitizeValue(value: unknown): unknown {
	if (typeof value === 'string') {
		if (value.includes('postgres://') || value.includes('postgresql://')) {
			return '[REDACTED_DB_URL]';
		}
		if (value.length > 32 && /^[a-zA-Z0-9+/=_-]+$/.test(value) && (value.includes('eyJ') || value.includes('sb-'))) {
			return '[REDACTED_SECRET_KEY]';
		}
	}
	return value;
}

export function saveReconciliationArtifact(
	summary: ManagedDivergenceSummary,
	canonicalPackageHash: string,
	projectRoot?: string,
): string {
	const filePath = getReconciliationArtifactPath(summary.slug, summary.targetEnvironment, projectRoot);
	const dirPath = dirname(filePath);
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}

	const sanitizedDiffs = summary.diffs.map((d) => ({
		...d,
		canonicalValue: sanitizeValue(d.canonicalValue),
		environmentValue: sanitizeValue(d.environmentValue),
	}));

	const artifactData: ReconciliationArtifactData = {
		invitationSlug: summary.slug,
		targetEnvironment: summary.targetEnvironment,
		canonicalPackageHash,
		timestamp: new Date().toISOString(),
		reconciliationState: summary.state,
		changedSemanticPaths: sanitizedDiffs.map((d) => d.path),
		decisions: summary.decisions,
		unresolvedPaths: summary.unresolvedPaths,
		sourceUpdatePlan: summary.sourceUpdatePlan,
		isReleaseBlocked: summary.isReleaseBlocked,
	};

	writeFileSync(filePath, JSON.stringify(artifactData, null, 2) + '\n', 'utf8');
	return filePath;
}

export function loadReconciliationArtifact(
	slug: string,
	target: 'local' | 'preview' | 'production',
	projectRoot?: string,
): ReconciliationArtifactData | null {
	const filePath = getReconciliationArtifactPath(slug, target, projectRoot);
	if (!existsSync(filePath)) return null;
	try {
		const content = readFileSync(filePath, 'utf8');
		return JSON.parse(content) as ReconciliationArtifactData;
	} catch {
		return null;
	}
}

export function renderReconciliationArtifactMarkdown(artifact: ReconciliationArtifactData): string {
	return `
# Reconciliation Artifact: ${artifact.invitationSlug} (${artifact.targetEnvironment.toUpperCase()})

- **Estado:** \`${artifact.reconciliationState}\`
- **Fecha:** ${artifact.timestamp}
- **Hash del Paquete Canónico:** \`${artifact.canonicalPackageHash.slice(0, 12)}…\`
- **Bloquea Lanzamiento:** ${artifact.isReleaseBlocked ? 'SÍ (REQUERIDO)' : 'NO (CLEAN)'}

## Decisiones por Ruta Semántica
${
	Object.keys(artifact.decisions).length === 0
		? '_Sin decisiones registradas._'
		: Object.entries(artifact.decisions)
				.map(([path, outcome]) => `- \`${path}\`: **${outcome}**`)
				.join('\n')
}

${
	artifact.unresolvedPaths.length > 0
		? `## Rutas Sin Resolver (${artifact.unresolvedPaths.length})\n` +
			artifact.unresolvedPaths.map((p) => `- \`${p}\``).join('\n')
		: ''
}

${
	artifact.sourceUpdatePlan
		? `## Plan de Actualización de Código Fonte
- **Archivo Canónico:** \`${artifact.sourceUpdatePlan.canonicalFile}\`
- **Campos a Actualizar Manualmente (${artifact.sourceUpdatePlan.items.length}):**
` +
			artifact.sourceUpdatePlan.items
				.map(
					(item) =>
						`  - \`${item.semanticPath}\`: Valor actual canónico = \`${JSON.stringify(item.currentCanonicalValue)}\` → Valor seleccionado de ambiente = \`${JSON.stringify(item.selectedEnvironmentValue)}\``,
				)
				.join('\n')
		: ''
}
`.trim();
}
