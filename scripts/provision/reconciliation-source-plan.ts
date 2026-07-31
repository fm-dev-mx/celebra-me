/**
 * reconciliation-source-plan.ts — Source Update Plan Generator
 *
 * Generates an actionable plan detailing exact changes required in the canonical
 * TypeScript file when an operator selects KEEP_ENVIRONMENT.
 *
 * Safety:
 *  - KEEP_ENVIRONMENT NEVER modifies the canonical TypeScript file automatically.
 *  - Generates actionable documentation and instructions for deliberate manual editing.
 */

import type { SourceUpdatePlan } from './reconciliation-state.ts';

export function formatSourceUpdatePlanMarkdown(plan: SourceUpdatePlan): string {
	const header = `# Actionable Source Update Plan: ${plan.slug}\n\n` +
		`> [!IMPORTANT]\n` +
		`> Selecting \`KEEP_ENVIRONMENT\` requires manually updating the canonical TypeScript definition file.\n` +
		`> The target database MUST NOT become an implicit source of truth. Edit the definition file, regenerate the package, and rerun reconciliation to achieve \`CLEAN\` state.\n\n` +
		`**Canonical Target File:** \`${plan.canonicalFile}\`  \n` +
		`**Generated At:** ${plan.createdAt}  \n\n` +
		`## Required Manual Edits (${plan.items.length} path/s)\n\n`;

	const items = plan.items
		.map((item, index) => {
			return `### ${index + 1}. \`${item.semanticPath}\` (Section: \`${item.section}\`)\n` +
				`- **Current TypeScript Value:** \`${JSON.stringify(item.currentCanonicalValue)}\`  \n` +
				`- **Selected Target Value:** \`${JSON.stringify(item.selectedEnvironmentValue)}\`  \n` +
				`- **Action:** Update \`${item.semanticPath}\` in \`${item.canonicalFile}\` to match \`${JSON.stringify(item.selectedEnvironmentValue)}\`.`;
		})
		.join('\n\n');

	return `${header}${items}\n`;
}
