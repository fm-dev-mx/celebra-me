/**
 * conflict-resolutions.ts — Load, validate, and merge path policies
 * (merge conflicts + selective field apply).
 */
import { readFileSync, existsSync } from 'node:fs';
import type { ConflictResolutionChoice, ConflictResolutions } from './semantic-delta.ts';
import type { FunctionalChange } from './invitation-update-plan.ts';

export function parseConflictResolutionsJson(raw: unknown): ConflictResolutions {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(
			'Las resoluciones deben ser un objeto JSON { "<path>": "package" | "target" }.',
		);
	}
	const result: ConflictResolutions = {};
	for (const [path, choice] of Object.entries(raw as Record<string, unknown>)) {
		if (choice !== 'package' && choice !== 'target') {
			throw new Error(
				`Resolución inválida para "${path}": use "package" o "target" (recibido ${JSON.stringify(choice)}).`,
			);
		}
		result[path] = choice as ConflictResolutionChoice;
	}
	return result;
}

function loadResolutionsWrapperFile(path: string, label: string): ConflictResolutions {
	if (!existsSync(path)) {
		throw new Error(`No se encontró el archivo de ${label}: ${path}`);
	}
	const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
	if (
		!parsed ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed) ||
		!(
			'resolutions' in parsed &&
			(parsed as { resolutions: unknown }).resolutions &&
			typeof (parsed as { resolutions: unknown }).resolutions === 'object' &&
			!Array.isArray((parsed as { resolutions: unknown }).resolutions)
		)
	) {
		throw new Error(
			`El archivo de ${label} debe ser { "resolutions": { "<path>": "package" | "target" } }.`,
		);
	}
	return parseConflictResolutionsJson((parsed as { resolutions: unknown }).resolutions);
}

export function loadConflictResolutionsFile(
	path: string,
	label = 'resoluciones',
): ConflictResolutions {
	return loadResolutionsWrapperFile(path, label);
}

/**
 * Merge field selections with conflict resolutions.
 * Conflict resolutions win on overlapping paths (deterministic).
 */
export function mergePathPolicies(
	fieldSelections?: ConflictResolutions,
	conflictResolutions?: ConflictResolutions,
): ConflictResolutions | undefined {
	if (!fieldSelections && !conflictResolutions) return undefined;
	return {
		...(fieldSelections ?? {}),
		...(conflictResolutions ?? {}),
	};
}

export function sortPathPolicy(policy: ConflictResolutions | undefined): ConflictResolutions | null {
	if (!policy || Object.keys(policy).length === 0) return null;
	return Object.keys(policy)
		.sort()
		.reduce<ConflictResolutions>((acc, key) => {
			acc[key] = policy[key]!;
			return acc;
		}, {});
}

export function fingerprintPathPolicy(policy: ConflictResolutions | undefined): string | undefined {
	const sorted = sortPathPolicy(policy);
	return sorted ? JSON.stringify(sorted) : undefined;
}

export function suggestConflictResolutionsFile(
	conflicts: Array<{ path: string }>,
): { resolutions: ConflictResolutions } {
	const resolutions: ConflictResolutions = {};
	for (const conflict of conflicts) {
		resolutions[conflict.path] = 'target';
	}
	return { resolutions };
}

/** Top-level content key for a functional change field path (e.g. `rsvp.title` → `rsvp`). */
export function fieldPathRoot(fieldPath: string): string {
	const match = /^([^.[]+)/.exec(fieldPath);
	return match?.[1] ?? fieldPath;
}

/**
 * Build a path policy from selected vs available paths (fields or section roots).
 * Selected → package; deselected → target.
 */
export function buildPathPolicyFromSelection(input: {
	availablePaths: string[];
	selectedPaths: string[];
}): ConflictResolutions {
	const selected = new Set(input.selectedPaths);
	const resolutions: ConflictResolutions = {};
	for (const path of input.availablePaths) {
		resolutions[path] = selected.has(path) ? 'package' : 'target';
	}
	return resolutions;
}

export function collectSelectableFieldPaths(changes: FunctionalChange[] | undefined): string[] {
	if (!changes) return [];
	const paths = new Set<string>();
	for (const change of changes) {
		if (change.scope !== 'database' || !change.field) continue;
		paths.add(change.field);
	}
	return Array.from(paths).sort();
}

export function collectSelectableSectionRoots(changes: FunctionalChange[] | undefined): string[] {
	const roots = new Set<string>();
	for (const path of collectSelectableFieldPaths(changes)) {
		roots.add(fieldPathRoot(path));
	}
	return Array.from(roots).sort();
}
