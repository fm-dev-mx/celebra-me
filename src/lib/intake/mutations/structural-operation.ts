export type StructuralPathToken = string | number;

export type StructuralOperation =
	| { kind: 'add'; path: StructuralPathToken[]; value: unknown }
	| { kind: 'replace'; path: StructuralPathToken[]; value: unknown }
	| { kind: 'remove'; path: StructuralPathToken[] };

export interface StructuralValueState {
	present: boolean;
	value?: unknown;
}

export function structuralPathToString(path: readonly StructuralPathToken[]): string {
	return path
		.map((token, index) =>
			typeof token === 'number' ? `[${token}]` : `${index === 0 ? '' : '.'}${token}`,
		)
		.join('');
}

function cloneJsonValue<T>(value: T): T {
	return value === undefined ? value : (structuredClone(value) as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function equalJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function buildArrayContractionOperations(
	previous: unknown[],
	current: unknown[],
	path: StructuralPathToken[],
): StructuralOperation[] | null {
	const keptPreviousIndices: number[] = [];
	let currentIndex = 0;
	for (let previousIndex = 0; previousIndex < previous.length; previousIndex += 1) {
		if (currentIndex < current.length && equalJson(previous[previousIndex], current[currentIndex])) {
			keptPreviousIndices.push(previousIndex);
			currentIndex += 1;
		}
	}
	if (currentIndex !== current.length) return null;

	const kept = new Set(keptPreviousIndices);
	return previous
		.map((_, index) => index)
		.filter((index) => !kept.has(index))
		.sort((left, right) => right - left)
		.map((index) => ({ kind: 'remove', path: [...path, index] }) as const);
}

/**
 * Build the canonical JSON structural vocabulary used by managed reconciliation.
 * Missing properties are represented by remove operations, never by an undefined assignment.
 */
export function buildStructuralOperations(
	previous: StructuralValueState,
	current: StructuralValueState,
	path: StructuralPathToken[] = [],
): StructuralOperation[] {
	if (!previous.present && !current.present) return [];
	if (!previous.present) {
		return [{ kind: 'add', path, value: cloneJsonValue(current.value) }];
	}
	if (!current.present) return [{ kind: 'remove', path }];
	if (equalJson(previous.value, current.value)) return [];

	if (Array.isArray(previous.value) && Array.isArray(current.value)) {
		const contraction = buildArrayContractionOperations(previous.value, current.value, path);
		if (contraction) return contraction;
		return [{ kind: 'replace', path, value: cloneJsonValue(current.value) }];
	}

	if (isRecord(previous.value) && isRecord(current.value)) {
		const previousRecord = previous.value;
		const currentRecord = current.value;
		const keys = new Set([...Object.keys(previousRecord), ...Object.keys(currentRecord)]);
		return [...keys]
			.sort()
			.flatMap((key) =>
				buildStructuralOperations(
					{ present: Object.hasOwn(previousRecord, key), value: previousRecord[key] },
					{ present: Object.hasOwn(currentRecord, key), value: currentRecord[key] },
					[...path, key],
				),
			);
	}

	return [{ kind: 'replace', path, value: cloneJsonValue(current.value) }];
}

function resolveParent(
	root: Record<string, unknown>,
	path: readonly StructuralPathToken[],
): { parent: Record<string | number, unknown> | unknown[]; key: StructuralPathToken } {
	if (path.length === 0) throw new Error('Root structural operations are not supported.');
	let current: unknown = root;
	for (let index = 0; index < path.length - 1; index += 1) {
		const token = path[index]!;
		const nextToken = path[index + 1]!;
		if (!current || typeof current !== 'object') {
			throw new Error(`Cannot traverse structural path ${structuralPathToString(path)}.`);
		}
		const container = current as Record<string | number, unknown>;
		if (container[token] === undefined) {
			container[token] = typeof nextToken === 'number' ? [] : {};
		}
		current = container[token];
	}
	if (!current || typeof current !== 'object') {
		throw new Error(`Cannot resolve structural path ${structuralPathToString(path)}.`);
	}
	return {
		parent: current as Record<string | number, unknown> | unknown[],
		key: path[path.length - 1]!,
	};
}

export function applyStructuralOperations(
	target: Record<string, unknown>,
	operations: readonly StructuralOperation[],
): Record<string, unknown> {
	const result = cloneJsonValue(target);
	for (const operation of operations) {
		const { parent, key } = resolveParent(result, operation.path);
		if (operation.kind === 'remove') {
			if (Array.isArray(parent) && typeof key === 'number') parent.splice(key, 1);
			else delete (parent as Record<string | number, unknown>)[key];
			continue;
		}
		(parent as Record<string | number, unknown>)[key] = cloneJsonValue(operation.value);
	}
	return result;
}
