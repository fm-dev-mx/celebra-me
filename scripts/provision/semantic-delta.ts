/** Three-way managed reconciliation using the shared structural-operation vocabulary. */
import {
	applyStructuralOperations,
	buildStructuralOperations,
	structuralPathToString,
	type StructuralOperation,
	type StructuralPathToken,
	type StructuralValueState,
} from '../../src/lib/intake/mutations/structural-operation.ts';
import { canonicalize } from './normalized-invitation-release.ts';

export type UpdateScope = 'content-only' | 'content-and-assets' | 'assets-only';

export interface SemanticFieldDelta {
	path: string;
	operation: StructuralOperation['kind'];
	previousCanonicalPresent: boolean;
	currentCanonicalPresent: boolean;
	currentTargetPresent: boolean;
	previousCanonicalValue: unknown;
	currentCanonicalValue: unknown;
	currentTargetValue: unknown;
	isAssetField: boolean;
	status: 'APPLY' | 'ALREADY_APPLIED' | 'DRIFT' | 'BLOCKED_BY_SCOPE';
	appliedValue: unknown;
}

export type SemanticDelta = SemanticFieldDelta;

export interface SemanticPatchResult {
	patchedContent: Record<string, unknown>;
	operations: StructuralOperation[];
	deltas: SemanticFieldDelta[];
	hasContentChanges: boolean;
	hasAssetChanges: boolean;
	blocked: boolean;
	blockReason?: string;
}

class AssetPreservationViolationError extends Error {
	constructor(target: string, fieldPath: string, reason: string) {
		super(`ASSET_PRESERVATION_VIOLATION [Target: ${target}, Path: ${fieldPath}]: ${reason}`);
		this.name = 'AssetPreservationViolationError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAssetReference(value: unknown): boolean {
	return isRecord(value) && value.type === 'uploaded' && ('assetId' in value || 'src' in value);
}

function isAssetFieldPath(path: string, ...values: unknown[]): boolean {
	if (values.some(isAssetReference)) return true;
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

function equalState(left: StructuralValueState, right: StructuralValueState): boolean {
	if (left.present !== right.present) return false;
	if (!left.present) return true;
	return canonicalize(left.value) === canonicalize(right.value);
}

function childState(parent: StructuralValueState, key: string): StructuralValueState {
	if (!parent.present || !isRecord(parent.value)) return { present: false };
	return { present: Object.hasOwn(parent.value, key), value: parent.value[key] };
}

export type ConflictResolutionChoice = 'package' | 'target';
export type ConflictResolutions = Record<string, ConflictResolutionChoice>;

export function resolvePathPolicy(
	path: string,
	resolutions: ConflictResolutions,
): ConflictResolutionChoice | undefined {
	if (resolutions[path]) return resolutions[path];
	let best: { prefix: string; choice: ConflictResolutionChoice } | undefined;
	for (const [key, choice] of Object.entries(resolutions)) {
		if (!key || key === path) continue;
		if (!path.startsWith(`${key}.`) && !path.startsWith(`${key}[`)) continue;
		if (!best || key.length > best.prefix.length) best = { prefix: key, choice };
	}
	return best?.choice;
}

export class MergeConflictError extends Error {
	readonly code = 'merge_conflict';
	constructor(message: string, readonly deltas: SemanticFieldDelta[]) {
		super(message);
		this.name = 'MergeConflictError';
	}
}

interface ReconcileContext {
	scope: UpdateScope;
	targetName: string;
	resolutions: ConflictResolutions;
	deltas: SemanticFieldDelta[];
	operations: StructuralOperation[];
	blockedReasons: string[];
}

function canReconcileRecordChildren(
	previous: StructuralValueState,
	current: StructuralValueState,
	target: StructuralValueState,
): boolean {
	if (!previous.present || !current.present || !target.present) return false;
	if (!isRecord(previous.value) || !isRecord(current.value) || !isRecord(target.value)) return false;
	return ![previous.value, current.value, target.value].some(isAssetReference);
}

function canReconcileArrayChildren(
	previous: StructuralValueState,
	current: StructuralValueState,
	target: StructuralValueState,
): boolean {
	if (!previous.present || !current.present || !target.present) return false;
	if (!Array.isArray(previous.value) || !Array.isArray(current.value) || !Array.isArray(target.value)) return false;
	return previous.value.length === current.value.length && previous.value.length === target.value.length;
}

function isBlockedByScope(scope: UpdateScope, isAsset: boolean): boolean {
	return (isAsset && scope === 'content-only') || (!isAsset && scope === 'assets-only');
}

function pushDecision(
	context: ReconcileContext,
	pathTokens: StructuralPathToken[],
	previous: StructuralValueState,
	current: StructuralValueState,
	target: StructuralValueState,
	status: SemanticFieldDelta['status'],
): void {
	const changes = buildStructuralOperations(previous, current, pathTokens);
	const fallbackOperation: StructuralOperation = current.present
		? { kind: previous.present ? 'replace' : 'add', path: pathTokens, value: current.value }
		: { kind: 'remove', path: pathTokens };
	const operations = changes.length > 0 ? changes : [fallbackOperation];
	for (const operation of operations) {
		const path = structuralPathToString(operation.path);
		const operationTarget = operation.path.length === pathTokens.length ? target.value : undefined;
		context.deltas.push({
			path,
			operation: operation.kind,
			previousCanonicalPresent: previous.present,
			currentCanonicalPresent: current.present,
			currentTargetPresent: target.present,
			previousCanonicalValue: previous.value,
			currentCanonicalValue: current.value,
			currentTargetValue: operationTarget,
			isAssetField: isAssetFieldPath(path, previous.value, current.value, target.value),
			status,
			appliedValue: status === 'APPLY' ? current.value : target.value,
		});
		if (status === 'APPLY') context.operations.push(operation);
	}
}

function reconcileNode(
	context: ReconcileContext,
	pathTokens: StructuralPathToken[],
	previous: StructuralValueState,
	current: StructuralValueState,
	target: StructuralValueState,
): void {
	if (equalState(previous, current)) return;

	const path = structuralPathToString(pathTokens);
	const isAsset = isAssetFieldPath(path, previous.value, current.value, target.value);
	const blockedByScope = isBlockedByScope(context.scope, isAsset);
	if (blockedByScope) {
		pushDecision(context, pathTokens, previous, current, target, 'BLOCKED_BY_SCOPE');
		if (isAsset) {
			context.blockedReasons.push(
				new AssetPreservationViolationError(
					context.targetName,
					path,
					`La ruta de archivo "${path}" cambió con alcance "content-only".`,
				).message,
			);
		}
		return;
	}

	if (equalState(current, target)) {
		pushDecision(context, pathTokens, previous, current, target, 'ALREADY_APPLIED');
		return;
	}

	// Recurse only for fields that existed as ordinary objects in all three states. A field added
	// independently on both sides is one concurrent addition and must conflict when values differ.
	if (canReconcileRecordChildren(previous, current, target)) {
		const previousRecord = previous.value as Record<string, unknown>;
		const currentRecord = current.value as Record<string, unknown>;
		const targetRecord = target.value as Record<string, unknown>;
		const keys = new Set([
			...Object.keys(previousRecord),
			...Object.keys(currentRecord),
			...Object.keys(targetRecord),
		]);
		for (const key of [...keys].sort()) {
			reconcileNode(
				context,
				[...pathTokens, key],
				childState(previous, key),
				childState(current, key),
				childState(target, key),
			);
		}
		return;
	}
	if (canReconcileArrayChildren(previous, current, target)) {
		const previousArray = previous.value as unknown[];
		const currentArray = current.value as unknown[];
		const targetArray = target.value as unknown[];
		for (let index = 0; index < previousArray.length; index += 1) {
			reconcileNode(
				context,
				[...pathTokens, index],
				{ present: true, value: previousArray[index] },
				{ present: true, value: currentArray[index] },
				{ present: true, value: targetArray[index] },
			);
		}
		return;
	}
	if (equalState(previous, target)) {
		const resolution = resolvePathPolicy(path, context.resolutions);
		pushDecision(context, pathTokens, previous, current, target, resolution === 'target' ? 'ALREADY_APPLIED' : 'APPLY');
		return;
	}

	const resolution = resolvePathPolicy(path, context.resolutions);
	if (resolution === 'package') {
		pushDecision(context, pathTokens, previous, current, target, 'APPLY');
		return;
	}
	if (resolution === 'target') {
		pushDecision(context, pathTokens, previous, current, target, 'ALREADY_APPLIED');
		return;
	}
	pushDecision(context, pathTokens, previous, current, target, 'DRIFT');
	context.blockedReasons.push(
		`Conflicto de derivación en "${path}": paquete y destino cambiaron de forma divergente.`,
	);
}

export function apply3WaySemanticPatch(params: {
	previousCanonical: Record<string, unknown>;
	currentCanonical: Record<string, unknown>;
	currentTarget: Record<string, unknown>;
	scope: UpdateScope;
	targetName?: string;
	resolutions?: ConflictResolutions;
}): SemanticPatchResult {
	const context: ReconcileContext = {
		scope: params.scope,
		targetName: params.targetName ?? 'target',
		resolutions: params.resolutions ?? {},
		deltas: [],
		operations: [],
		blockedReasons: [],
	};

	const keys = new Set([
		...Object.keys(params.previousCanonical),
		...Object.keys(params.currentCanonical),
		...Object.keys(params.currentTarget),
	]);
	for (const key of [...keys].sort()) {
		reconcileNode(
			context,
			[key],
			{ present: Object.hasOwn(params.previousCanonical, key), value: params.previousCanonical[key] },
			{ present: Object.hasOwn(params.currentCanonical, key), value: params.currentCanonical[key] },
			{ present: Object.hasOwn(params.currentTarget, key), value: params.currentTarget[key] },
		);
	}

	return {
		patchedContent: applyStructuralOperations(params.currentTarget, context.operations),
		operations: context.operations,
		deltas: context.deltas,
		hasContentChanges: context.deltas.some((delta) => !delta.isAssetField),
		hasAssetChanges: context.deltas.some((delta) => delta.isAssetField),
		blocked: context.blockedReasons.length > 0,
		...(context.blockedReasons[0] ? { blockReason: context.blockedReasons[0] } : {}),
	};
}

export function listDriftConflicts(deltas: SemanticFieldDelta[]): SemanticFieldDelta[] {
	return deltas.filter((delta) => delta.status === 'DRIFT');
}
