/**
 * reconciliation-presenter.ts — Adaptive Reconciliation UX Presenter
 *
 * Provides adaptive Terminal/CLI UX presentation scaled by diff size:
 *  - Small diff (1–10 paths): Direct field-level review list.
 *  - Medium diff (11–40 paths): Grouped by semantic section with section drill-down.
 *  - Large diff (>40 paths): Grouped summary, affected section counts, risk/destructive indicators, filtered review.
 */

import type { ManagedDivergenceSummary, ManagedFieldDiff } from './reconciliation-state.ts';

export function formatAdaptiveReconciliationSummary(summary: ManagedDivergenceSummary): string {
	const count = summary.totalManagedDiffs;

	if (count === 0) {
		return `✔ No divergence detected for "${summary.slug}" on ${summary.targetEnvironment.toUpperCase()}. State is CLEAN.`;
	}

	const lines: string[] = [];
	lines.push(`=== Managed Content Divergence: ${summary.slug} (${summary.targetEnvironment.toUpperCase()}) ===`);
	lines.push(`Estado actual: [${summary.state}]`);
	lines.push(`Campos modificados: ${count} | Secciones afectadas: ${summary.affectedSectionCount}`);
	lines.push(`Bloquea publicación/release: ${summary.isReleaseBlocked ? 'SÍ' : 'NO'}`);
	lines.push('');

	if (count <= 10) {
		// Small diff presentation
		lines.push('--- REVISIÓN DIRECTA DE CAMPOS (DIFERENCIA PEQUEÑA) ---');
		for (const diff of summary.diffs) {
			const status = summary.decisions[diff.path] ?? 'SIN_RESOLVER';
			lines.push(`• [${diff.section.toUpperCase()}] ${diff.path}`);
			lines.push(`   Canónico:    ${JSON.stringify(diff.canonicalValue)}`);
			lines.push(`   Ambiente:    ${JSON.stringify(diff.environmentValue)}`);
			lines.push(`   Decisión:    ${status}`);
		}
	} else if (count <= 40) {
		// Medium diff presentation
		lines.push('--- REVISIÓN AGRUPADA POR SECCIÓN (DIFERENCIA MEDIANA) ---');
		const grouped = new Map<string, ManagedFieldDiff[]>();
		for (const diff of summary.diffs) {
			const list = grouped.get(diff.section) ?? [];
			list.push(diff);
			grouped.set(diff.section, list);
		}
		for (const [section, items] of grouped.entries()) {
			lines.push(`\n📁 Sección "${section.toUpperCase()}" (${items.length} campos):`);
			for (const item of items) {
				const status = summary.decisions[item.path] ?? 'SIN_RESOLVER';
				lines.push(`   - ${item.path} -> ${status}`);
			}
		}
	} else {
		// Large diff presentation
		lines.push('--- RESUMEN EJECUTIVO AGRUPADO (DIFERENCIA GRANDE > 40 CAMPOS) ---');
		lines.push('⚠ ATENCIÓN: Volumen alto de cambios en borrador de ambiente.');
		const grouped = new Map<string, { count: number; destructive: number }>();
		for (const diff of summary.diffs) {
			const info = grouped.get(diff.section) ?? { count: 0, destructive: 0 };
			info.count++;
			if (diff.isDestructive) info.destructive++;
			grouped.set(diff.section, info);
		}
		for (const [section, info] of grouped.entries()) {
			const warn = info.destructive > 0 ? ` (⚠ ${info.destructive} eliminaciones)` : '';
			lines.push(`   • Sección \`${section}\`: ${info.count} campo(s) modificados${warn}`);
		}
		lines.push('\nConsulte el artefacto durable de reconciliación para el desglose detallado.');
	}

	if (summary.isReleaseBlocked && summary.blockerReason) {
		lines.push(`\n⚠ BLOQUEADOR ACTIVADO: ${summary.blockerReason}`);
	}

	return lines.join('\n');
}
