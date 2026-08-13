/**
 * Named public-object contract comparison for db:*:audit.
 * Not a general schema comparator: indexes, constraints, and routines only.
 */

export type StructuralObjectType = 'index' | 'constraint' | 'routine';

export type StructuralFindingKind =
	| 'missing_expected'
	| 'unexpected'
	| 'noncanonical_name'
	| 'incompatible_definition';

export interface StructuralFinding {
	kind: StructuralFindingKind;
	objectType: StructuralObjectType;
	tableName?: string;
	expectedName: string;
	actualName?: string;
	detail: string;
}

export interface NamedIndex {
	tableName: string;
	indexName: string;
	indexDef: string;
}

export interface NamedConstraint {
	tableName: string;
	constraintName: string;
	constraintType: string;
	definition: string;
}

export interface NamedRoutine {
	routineName: string;
	routineType: string;
	identityArgs: string;
	definition: string;
}

/** Application RPCs already owned by the mutation schema contract. */
const CONTRACT_ROUTINE_NAMES = new Set([
	'save_invitation_metadata_atomic',
	'restore_invitation_from_published_atomic',
	'submit_guest_rsvp_public',
	'track_guest_invitation_view_public',
]);

export function toContractRoutines(
	routines: readonly NamedRoutine[],
): NamedRoutine[] {
	return routines.filter((item) => CONTRACT_ROUTINE_NAMES.has(item.routineName));
}

export function normalizeDef(def: string, name: string): string {
	return def
		.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'NAME_PLACEHOLDER')
		// Hosted FKs qualify auth.users; disposable often resolves users via search_path.
		.replace(/\bauth\./g, '')
		.replace(/\s+/g, ' ')
		.replace(/::text/g, '')
		.replace(/["'()]/g, '')
		.trim();
}

interface NamedShape {
	table?: string;
	name: string;
	shape: string;
}

function diffNamedShapes(
	objectType: StructuralObjectType,
	expected: readonly NamedShape[],
	actual: readonly NamedShape[],
): StructuralFinding[] {
	const findings: StructuralFinding[] = [];
	const expectedByName = new Map(expected.map((item) => [item.name, item]));
	const actualByName = new Map(actual.map((item) => [item.name, item]));
	const usedActual = new Set<string>();

	for (const exp of expected) {
		const byName = actualByName.get(exp.name);
		if (byName) {
			usedActual.add(byName.name);
			if (byName.shape !== exp.shape) {
				findings.push({
					kind: 'incompatible_definition',
					objectType,
					tableName: exp.table,
					expectedName: exp.name,
					actualName: byName.name,
					detail: `${objectType} "${exp.name}" definition does not match the disposable contract.`,
				});
			}
			continue;
		}

		const alias = actual.find(
			(item) =>
				!usedActual.has(item.name) &&
				item.table === exp.table &&
				item.shape === exp.shape &&
				item.name !== exp.name,
		);
		if (alias) {
			usedActual.add(alias.name);
			findings.push({
				kind: 'noncanonical_name',
				objectType,
				tableName: exp.table,
				expectedName: exp.name,
				actualName: alias.name,
				detail: `${objectType} contract expects "${exp.name}" but target has equivalent "${alias.name}".`,
			});
			continue;
		}

		findings.push({
			kind: 'missing_expected',
			objectType,
			tableName: exp.table,
			expectedName: exp.name,
			detail: `Expected ${objectType} "${exp.name}" is missing on the target.`,
		});
	}

	for (const act of actual) {
		if (usedActual.has(act.name) || expectedByName.has(act.name)) continue;
		findings.push({
			kind: 'unexpected',
			objectType,
			tableName: act.table,
			expectedName: act.name,
			actualName: act.name,
			detail: `Unexpected ${objectType} "${act.name}" is present on the target.`,
		});
	}

	return findings;
}

export function diffContractIndexes(
	expected: readonly NamedIndex[],
	actual: readonly NamedIndex[],
): StructuralFinding[] {
	return diffNamedShapes(
		'index',
		expected.map((item) => ({
			table: item.tableName,
			name: item.indexName,
			shape: `${item.tableName}::${normalizeDef(item.indexDef, item.indexName)}`,
		})),
		actual.map((item) => ({
			table: item.tableName,
			name: item.indexName,
			shape: `${item.tableName}::${normalizeDef(item.indexDef, item.indexName)}`,
		})),
	);
}

export function diffContractConstraints(
	expected: readonly NamedConstraint[],
	actual: readonly NamedConstraint[],
): StructuralFinding[] {
	return diffNamedShapes(
		'constraint',
		expected.map((item) => ({
			table: item.tableName,
			name: item.constraintName,
			shape: `${item.tableName}::${item.constraintType}::${normalizeDef(item.definition, item.constraintName)}`,
		})),
		actual.map((item) => ({
			table: item.tableName,
			name: item.constraintName,
			shape: `${item.tableName}::${item.constraintType}::${normalizeDef(item.definition, item.constraintName)}`,
		})),
	);
}

export function diffContractRoutines(
	expected: readonly NamedRoutine[],
	actual: readonly NamedRoutine[],
): StructuralFinding[] {
	return diffNamedShapes(
		'routine',
		expected.map((item) => ({
			name: `${item.routineName}(${item.identityArgs})`,
			shape: `${item.routineType}::${normalizeDef(item.definition, item.routineName)}`,
		})),
		actual.map((item) => ({
			name: `${item.routineName}(${item.identityArgs})`,
			shape: `${item.routineType}::${normalizeDef(item.definition, item.routineName)}`,
		})),
	);
}

export function formatStructuralFinding(finding: StructuralFinding): string {
	const table = finding.tableName ? ` on "${finding.tableName}"` : '';
	return `${finding.kind}: ${finding.objectType} "${finding.expectedName}"${table}${
		finding.actualName && finding.actualName !== finding.expectedName
			? ` (actual "${finding.actualName}")`
			: ''
	}`;
}
