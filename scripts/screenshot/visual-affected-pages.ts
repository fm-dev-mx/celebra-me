import { isVisualImpactPath, normalizeVisualPath } from '../ops/visual-impact.ts';
import type { VisualPageCase } from './visual-coverage-contract.ts';

/** Repository locations owned by exactly one invitation or demo page. */
function ownedPrefixes(entry: VisualPageCase): string[] {
	const prefixes = [
		`src/invitations/clients/${entry.slug}/`,
		`src/invitations/demos/${entry.slug}/`,
		`src/assets/invitations/${entry.slug}/`,
		`scripts/provision/invitations/${entry.slug}.ts`,
		`src/styles/invitation-profiles/${entry.slug}.scss`,
	];
	if (entry.assetSlug) prefixes.push(`src/assets/images/events/${entry.assetSlug}/`);
	return prefixes;
}

export interface AffectedVisualPages {
	/** Pages whose own files changed. */
	pages: VisualPageCase[];
	/** Visual-impact files no single page owns (shared SCSS, components, tooling). */
	shared: string[];
}

/**
 * Splits changed paths into the complete-page cases they belong to and the shared visual files
 * that may move any page. A shared change cannot be scoped: run the full certified candidate or
 * name the pages to check with `--pages`.
 */
export function affectedVisualPages(
	changedPaths: readonly string[],
	cases: readonly VisualPageCase[],
): AffectedVisualPages {
	const pages = new Set<VisualPageCase>();
	const shared = new Set<string>();
	for (const changed of changedPaths.map(normalizeVisualPath)) {
		if (!isVisualImpactPath(changed)) continue;
		const owners = cases.filter((entry) =>
			ownedPrefixes(entry).some((prefix) => changed.startsWith(prefix)),
		);
		if (owners.length === 0) shared.add(changed);
		for (const owner of owners) pages.add(owner);
	}
	return {
		pages: cases.filter((entry) => pages.has(entry)),
		shared: [...shared].sort(),
	};
}
