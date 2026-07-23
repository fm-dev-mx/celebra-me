/**
 * semantic-delta.ts — 3-Way Semantic Patch & Asset Preservation Engine
 *
 * Computes semantic deltas between canonical releases and applies non-destructive
 * 3-way patches onto target environment states.
 */

export type UpdateScope = 'content-only' | 'content-and-assets' | 'assets-only';

export interface SemanticFieldDelta {
	path: string;
	previousCanonicalValue: unknown;
	currentCanonicalValue: unknown;
	currentTargetValue: unknown;
	isAssetField: boolean;
	status: 'APPLY' | 'ALREADY_APPLIED' | 'DRIFT' | 'BLOCKED_BY_SCOPE';
	appliedValue: unknown;
}

export interface SemanticPatchResult {
	patchedContent: Record<string, unknown>;
	deltas: SemanticFieldDelta[];
	hasContentChanges: boolean;
	hasAssetChanges: boolean;
	blocked: boolean;
	blockReason?: string;
}

class AssetPreservationViolationError extends Error {
	constructor(
		public readonly target: string,
		public readonly fieldPath: string,
		public readonly reason: string,
	) {
		super(`ASSET_PRESERVATION_VIOLATION [Target: ${target}, Path: ${fieldPath}]: ${reason}`);
		this.name = 'AssetPreservationViolationError';
	}
}

/**
 * Checks if a path or value represents an asset-bearing reference.
 */
function isAssetReference(value: unknown): boolean {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const rec = value as Record<string, unknown>;
		if (rec.type === 'uploaded' && ('assetId' in rec || 'src' in rec)) {
			return true;
		}
	}
	return false;
}

function isAssetFieldPath(path: string, value?: unknown): boolean {
	if (isAssetReference(value)) return true;
	const lower = path.toLowerCase();
	return (
		lower.endsWith('.image') ||
		lower.endsWith('.backgroundimage') ||
		lower.endsWith('.backgroundimagemobile') ||
		lower.endsWith('.backgroundimagedesktop') ||
		lower.endsWith('.featuredimage') ||
		lower.endsWith('.ogimage') ||
		lower.includes('assets.')
	);
}

import { canonicalize } from './normalized-invitation-release.ts';

function canonicalJsonString(val: unknown): string {
	if (val === null || val === undefined || typeof val !== 'object') {
		return JSON.stringify(val ?? null);
	}
	return canonicalize(val);
}

/**
 * Flattens a nested object into dot-notation paths for leaf nodes and asset references.
 */
function flattenContentPaths(
	obj: unknown,
	prefix = '',
): Map<string, unknown> {
	const map = new Map<string, unknown>();
	if (obj === null || typeof obj !== 'object') {
		if (prefix) map.set(prefix, obj);
		return map;
	}
	if (isAssetReference(obj)) {
		map.set(prefix, obj);
		return map;
	}
	if (Array.isArray(obj)) {
		if (obj.length === 0) {
			map.set(prefix, []);
			return map;
		}
		obj.forEach((item, idx) => {
			const itemPath = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
			const childMap = flattenContentPaths(item, itemPath);
			for (const [k, v] of childMap.entries()) {
				map.set(k, v);
			}
		});
		return map;
	}
	const rec = obj as Record<string, unknown>;
	const keys = Object.keys(rec);
	if (keys.length === 0 && prefix) {
		map.set(prefix, {});
		return map;
	}
	for (const key of keys) {
		const childPath = prefix ? `${prefix}.${key}` : key;
		const childMap = flattenContentPaths(rec[key], childPath);
		for (const [k, v] of childMap.entries()) {
			map.set(k, v);
		}
	}
	return map;
}

/**
 * Sets a value at a dot-notation path on a clone of the target object.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, val: unknown): void {
	const tokens: Array<string | number> = [];
	const regex = /([^.[\]]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) tokens.push(match[1]);
		else if (match[2] !== undefined) tokens.push(Number(match[2]));
	}

	let current = obj as Record<string | number, unknown>;
	for (let i = 0; i < tokens.length - 1; i++) {
		const token = tokens[i]!;
		const nextToken = tokens[i + 1]!;
		if (current[token] === undefined || current[token] === null) {
			current[token] = typeof nextToken === 'number' ? [] : {};
		}
		current = current[token] as Record<string | number, unknown>;
	}
	const lastToken = tokens[tokens.length - 1]!;
	current[lastToken] = val;
}

/**
 * Performs a 3-way semantic patch calculation between:
 * 1. Previous canonical release
 * 2. Current canonical release
 * 3. Current target state
 */
export function apply3WaySemanticPatch(params: {
	previousCanonical: Record<string, unknown>;
	currentCanonical: Record<string, unknown>;
	currentTarget: Record<string, unknown>;
	scope: UpdateScope;
	targetName?: string;
}): SemanticPatchResult {
	const { previousCanonical, currentCanonical, currentTarget, scope, targetName = 'target' } = params;

	const prevMap = flattenContentPaths(previousCanonical);
	const currMap = flattenContentPaths(currentCanonical);
	const targetMap = flattenContentPaths(currentTarget);

	const allPaths = new Set<string>([
		...prevMap.keys(),
		...currMap.keys(),
		...targetMap.keys(),
	]);

	const deltas: SemanticFieldDelta[] = [];
	const patchedContent = JSON.parse(JSON.stringify(currentTarget)) as Record<string, unknown>;
	let hasContentChanges = false;
	let hasAssetChanges = false;
	let blocked = false;
	let blockReason: string | undefined;

	for (const path of Array.from(allPaths).sort()) {
		const prevVal = prevMap.get(path);
		const currVal = currMap.get(path);
		const targetVal = targetMap.get(path);

		const isPrevCurrSame = canonicalJsonString(prevVal) === canonicalJsonString(currVal);
		const isCurrTargetSame = canonicalJsonString(currVal) === canonicalJsonString(targetVal);
		const isPrevTargetSame = canonicalJsonString(prevVal) === canonicalJsonString(targetVal);

		const isAsset = isAssetFieldPath(path, currVal) || isAssetFieldPath(path, targetVal) || isAssetFieldPath(path, prevVal);

		if (isPrevCurrSame) {
			// No change in release delta for this path
			continue;
		}

		// Canonical release changed for this path
		if (isAsset) {
			hasAssetChanges = true;
			if (scope === 'content-only') {
				// Under content-only, asset changes are strictly prohibited
				const err = new AssetPreservationViolationError(
					targetName,
					path,
					`La ruta de archivo "${path}" cambió en la versión canónica pero el alcance es "content-only".`,
				);
				blocked = true;
				blockReason = err.message;
				deltas.push({
					path,
					previousCanonicalValue: prevVal,
					currentCanonicalValue: currVal,
					currentTargetValue: targetVal,
					isAssetField: true,
					status: 'BLOCKED_BY_SCOPE',
					appliedValue: targetVal,
				});
				continue;
			}
		} else {
			hasContentChanges = true;
			if (scope === 'assets-only') {
				deltas.push({
					path,
					previousCanonicalValue: prevVal,
					currentCanonicalValue: currVal,
					currentTargetValue: targetVal,
					isAssetField: false,
					status: 'BLOCKED_BY_SCOPE',
					appliedValue: targetVal,
				});
				continue;
			}
		}

		// Evaluate 3-way application
		if (isCurrTargetSame) {
			deltas.push({
				path,
				previousCanonicalValue: prevVal,
				currentCanonicalValue: currVal,
				currentTargetValue: targetVal,
				isAssetField: isAsset,
				status: 'ALREADY_APPLIED',
				appliedValue: targetVal,
			});
		} else if (isPrevTargetSame || prevVal === undefined) {
			// Target matches previous canonical -> safe to apply current canonical value
			deltas.push({
				path,
				previousCanonicalValue: prevVal,
				currentCanonicalValue: currVal,
				currentTargetValue: targetVal,
				isAssetField: isAsset,
				status: 'APPLY',
				appliedValue: currVal,
			});
			setNestedValue(patchedContent, path, currVal);
		} else {
			// Target matches neither previous nor current -> Target Drift!
			deltas.push({
				path,
				previousCanonicalValue: prevVal,
				currentCanonicalValue: currVal,
				currentTargetValue: targetVal,
				isAssetField: isAsset,
				status: 'DRIFT',
				appliedValue: targetVal,
			});
			blocked = true;
			blockReason = `Conflicto de derivación en "${path}": el destino no coincide con la versión anterior ni con la versión canónica.`;
		}
	}

	return {
		patchedContent,
		deltas,
		hasContentChanges,
		hasAssetChanges,
		blocked,
		blockReason,
	};
}
