/**
 * Canonical object-audit comparison.
 *
 * Validates the disposable reference before attributing named-object differences
 * to a hosted or persistent target. Pure: no database I/O.
 */

import {
	evaluateDisposableReference,
	REFERENCE_INVALID_LIFECYCLE,
	type DisposableReferenceInput,
	type DisposableReferenceVerdict,
} from './disposable-reference.ts';
import {
	diffContractConstraints,
	diffContractIndexes,
	diffContractRoutines,
	normalizeDef,
	toContractRoutines,
	type NamedConstraint,
	type NamedIndex,
	type NamedRoutine,
	type StructuralFinding,
} from './schema-object-contract.ts';

export interface TableMetadata {
	tableName: string;
	tableType: string;
}

export interface ColumnMetadata {
	tableName: string;
	columnName: string;
	dataType: string;
	isNullable: string;
	columnDefault: string | null;
}

export interface PolicyMetadata {
	tableName: string;
	policyName: string;
	roles: string;
	cmd: string;
	qual: string | null;
	withCheck: string | null;
}

export interface TriggerMetadata {
	tableName: string;
	triggerName: string;
	eventManipulation: string;
	actionStatement: string;
	actionTiming: string;
}

export interface GrantMetadata {
	grantee: string;
	tableName: string;
	privilegeType: string;
}

export interface SchemaMetadata {
	tables: TableMetadata[];
	columns: ColumnMetadata[];
	constraints: NamedConstraint[];
	indexes: NamedIndex[];
	policies: PolicyMetadata[];
	triggers: TriggerMetadata[];
	routines: NamedRoutine[];
	grants: GrantMetadata[];
}

export interface SchemaComparisonResult {
	errors: string[];
	infos: string[];
	structuralFindings: StructuralFinding[];
	structuralErrorCount: number;
}

function collectTableFindings(
	prodTables: TableMetadata[],
	localTables: TableMetadata[],
	prodTableNames: Set<string>,
	localTableNames: Set<string>,
	target: string,
): { errors: string[]; infos: string[] } {
	const errors: string[] = [];
	const infos: string[] = [];
	for (const t of prodTables) {
		if (!localTableNames.has(t.tableName)) {
			errors.push(`Table "${t.tableName}" exists in target but is missing locally!`);
		}
	}
	for (const t of localTables) {
		if (!prodTableNames.has(t.tableName)) {
			if (target === 'production' || target === 'preview') {
				infos.push(
					`Table "${t.tableName}" is local-only (expected addition before release).`,
				);
			} else {
				errors.push(`Expected table "${t.tableName}" is missing in target!`);
			}
		}
	}
	return { errors, infos };
}

function collectColumnFindings(
	prodCols: ColumnMetadata[],
	localCols: ColumnMetadata[],
	prodTableNames: Set<string>,
	localTableNames: Set<string>,
	target: string,
): { errors: string[]; infos: string[] } {
	const errors: string[] = [];
	const infos: string[] = [];
	const localColMap = new Map<string, ColumnMetadata>();
	for (const col of localCols) {
		localColMap.set(`${col.tableName}.${col.columnName}`, col);
	}
	const prodColMap = new Map<string, ColumnMetadata>();
	for (const col of prodCols) {
		prodColMap.set(`${col.tableName}.${col.columnName}`, col);
	}

	for (const col of prodCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const localCol = localColMap.get(key);
		if (!localCol) {
			if (localTableNames.has(col.tableName)) {
				errors.push(`Column "${key}" exists in target but is missing locally!`);
			}
			continue;
		}
		if (col.dataType !== localCol.dataType) {
			errors.push(
				`Column "${key}" type mismatch! Target="${col.dataType}", Local="${localCol.dataType}"`,
			);
		}
	}

	for (const col of localCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const prodCol = prodColMap.get(key);
		if (!prodCol && prodTableNames.has(col.tableName)) {
			if (target === 'production' || target === 'preview') {
				infos.push(`Column "${key}" is local-only (expected addition before release).`);
			} else {
				errors.push(`Expected column "${key}" is missing in target!`);
			}
		}
	}
	return { errors, infos };
}

function collectPolicyFindings(
	prodPolicies: PolicyMetadata[],
	localPolicies: PolicyMetadata[],
): string[] {
	const errors: string[] = [];
	for (const p of prodPolicies) {
		const match = localPolicies.find(
			(lp) => lp.tableName === p.tableName && lp.policyName === p.policyName,
		);
		if (!match) {
			errors.push(`RLS Policy "${p.policyName}" on "${p.tableName}" is missing locally!`);
		} else {
			const normProdQual = normalizeDef(p.qual || '', p.policyName);
			const normLocalQual = normalizeDef(match.qual || '', match.policyName);
			if (normProdQual !== normLocalQual) {
				errors.push(
					`RLS Policy "${p.policyName}" on "${p.tableName}" mismatch in target vs local!`,
				);
			}
		}
	}
	return errors;
}

function collectStructuralFindings(
	expected: SchemaMetadata,
	actual: SchemaMetadata,
): StructuralFinding[] {
	return [
		...diffContractIndexes(expected.indexes, actual.indexes),
		...diffContractConstraints(expected.constraints, actual.constraints),
		...diffContractRoutines(
			toContractRoutines(expected.routines),
			toContractRoutines(actual.routines),
		),
	];
}

/**
 * Compare a target schema against a disposable reference that has already been
 * validated. Do not call this when the reference is invalid.
 */
export function compareTargetToCanonicalReference(
	target: string,
	actual: SchemaMetadata,
	expected: SchemaMetadata,
	historyLifecycle: string,
): SchemaComparisonResult {
	const prodTableNames = new Set(actual.tables.map((t) => t.tableName));
	const localTableNames = new Set(expected.tables.map((t) => t.tableName));
	const tables = collectTableFindings(
		actual.tables,
		expected.tables,
		prodTableNames,
		localTableNames,
		target,
	);
	const columns = collectColumnFindings(
		actual.columns,
		expected.columns,
		prodTableNames,
		localTableNames,
		target,
	);
	const policyErrors = collectPolicyFindings(actual.policies, expected.policies);
	const structuralFindings = collectStructuralFindings(expected, actual);
	const blockingStructural =
		historyLifecycle === 'CURRENT' || historyLifecycle === 'SCHEMA_DRIFT';
	return {
		errors: [...tables.errors, ...columns.errors, ...policyErrors],
		infos: [...tables.infos, ...columns.infos],
		structuralFindings,
		structuralErrorCount: blockingStructural ? structuralFindings.length : 0,
	};
}

export interface CanonicalObjectAuditInput {
	target: string;
	historyLifecycle: string;
	extraRemoteCount: number;
	reference: DisposableReferenceInput;
	targetSchema: SchemaMetadata;
	referenceSchema: SchemaMetadata | null;
}

export interface CanonicalObjectAuditResult {
	lifecycle: string;
	errorCount: number;
	reference: DisposableReferenceVerdict;
	comparison: SchemaComparisonResult | null;
}

/**
 * Object-audit core: validate the disposable reference, then compare the target
 * only when that reference is trustworthy.
 */
export function runCanonicalObjectAudit(
	input: CanonicalObjectAuditInput,
): CanonicalObjectAuditResult {
	const reference = evaluateDisposableReference(input.reference);
	if (!reference.ok) {
		return {
			lifecycle: REFERENCE_INVALID_LIFECYCLE,
			errorCount: input.extraRemoteCount + 1,
			reference,
			comparison: null,
		};
	}

	if (!input.referenceSchema) {
		const failed = evaluateDisposableReference({
			...input.reference,
			introspectionError:
				input.reference.introspectionError ??
				'Validated reference did not supply schema metadata for comparison.',
			liveTableNames: null,
		});
		return {
			lifecycle: REFERENCE_INVALID_LIFECYCLE,
			errorCount: input.extraRemoteCount + 1,
			reference: failed,
			comparison: null,
		};
	}

	const comparison = compareTargetToCanonicalReference(
		input.target,
		input.targetSchema,
		input.referenceSchema,
		input.historyLifecycle,
	);
	return {
		lifecycle: input.historyLifecycle,
		errorCount:
			input.extraRemoteCount + comparison.errors.length + comparison.structuralErrorCount,
		reference,
		comparison,
	};
}
