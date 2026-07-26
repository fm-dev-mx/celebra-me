/**
 * invitation-update-plan.ts — Deterministic Semantic Plan Engine for Managed Invitations
 */

import { createHash } from 'node:crypto';
import type { AssetPolicy } from './asset-reconciliation.ts';

export type FunctionalOperation =
	| 'insert'
	| 'update'
	| 'delete'
	| 'move'
	| 'upload'
	| 'overwrite'
	| 'reuse'
	| 'repair_metadata'
	| 'skip';

export interface FunctionalChange {
	section: string;
	entity: string;
	label: string;
	operation: FunctionalOperation;
	field?: string;
	previousValue?: unknown;
	newValue?: unknown;
	scope: 'database' | 'storage';
	technicalWriteCount: number;
	targets?: string[];
	targetPreviousValues?: Record<string, unknown>;
}

export interface DatabaseOpsSummary {
	inserts: number;
	updates: number;
	deletes: number;
}

export interface StorageOpsSummary {
	uploads: number;
	overwrites: number;
	moves: number;
	deletes: number;
}

export interface TargetPreconditions {
	sourceHash?: string;
	packageHash?: string;
	assetManifestHash?: string;
	verifiedProjectRef?: string;
	targetInvitationId?: string;
	/** Stable owner UUID for new invitation creates (plan→apply). */
	targetOwnerUserId?: string;
	existingDraftUpdatedAt?: string;
	existingPublishedVersion?: number;
	assetStateHash?: string;
}

export type PlanExecutionStatus =
	'PLANNED' | 'EXECUTED' | 'IN_SYNC' | 'REVERTED' | 'FAILED_NEEDS_REVIEW' | 'STALE';

export interface ExecutionReceipt {
	planId: string;
	executedAt: string;
	status: PlanExecutionStatus;
	completedOperations: number;
	databaseWrites: DatabaseOpsSummary;
	storageMutations: StorageOpsSummary;
	publishedVersion?: number;
	recoveryNote?: string;
}

export interface OperationalPlan {
	planId: string;
	invitationSlug: string;
	invitationTitle: string;
	sourceHash: string;
	packageHash: string;
	assetPolicy?: AssetPolicy;
	targetEnvironment: 'local' | 'preview' | 'production';
	verifiedProjectRef: string;
	functionalChanges: FunctionalChange[];
	physicalDatabaseOps: DatabaseOpsSummary;
	storageOps: StorageOpsSummary;
	targetPreconditions: TargetPreconditions;
	sensitivityClassification: 'public' | 'internal' | 'sensitive';
	executionStatus: PlanExecutionStatus;
	receipt?: ExecutionReceipt;
}

export function computePlanId(params: {
	slug: string;
	sourceHash: string;
	targetEnvironment: string;
	projectRef: string;
	changes: FunctionalChange[];
	preconditions: TargetPreconditions;
	operationFingerprint?: string;
}): string {
	// NOTE: assetStateHash is intentionally excluded from planId computation.
	// Storage HTTP probes are served through Supabase's CDN, which may return
	// different cached content-lengths or headers across edge nodes, making
	// assetStateHash non-deterministic between the planning (dry-run) and
	// execution (apply) phases. DB-level preconditions (draft timestamp,
	// published version, invitation ID) provide sufficient safety guarantees.
	const { assetStateHash: _excluded, ...stablePreconditions } = params.preconditions;
	const raw = JSON.stringify({
		slug: params.slug,
		sourceHash: params.sourceHash,
		targetEnv: params.targetEnvironment,
		projectRef: params.projectRef,
		changes: params.changes.map((c) => ({
			s: c.section,
			e: c.entity,
			op: c.operation,
			f: c.field,
			before: c.previousValue,
			after: c.newValue,
			scope: c.scope,
		})),
		preconditions: stablePreconditions,
		operationFingerprint: params.operationFingerprint,
	});
	return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function normalizeTimestamp(ts?: string): string | undefined {
	if (!ts) return undefined;
	const d = new Date(ts);
	return isNaN(d.getTime()) ? ts.trim() : d.toISOString();
}

export function verifyPlanPreconditions(
	plan: OperationalPlan,
	currentState: {
		sourceHash?: string;
		packageHash?: string;
		verifiedProjectRef?: string;
		existingDraftUpdatedAt?: string;
		existingPublishedVersion?: number;
		targetInvitationId?: string;
		targetOwnerUserId?: string;
		assetStateHash?: string;
		assetManifestHash?: string;
	},
): { ok: boolean; reason?: string } {
	const { targetPreconditions } = plan;
	const mismatch = (key: keyof TargetPreconditions): boolean =>
		targetPreconditions[key] !== undefined && targetPreconditions[key] !== currentState[key];

	if (mismatch('sourceHash') || plan.sourceHash !== currentState.sourceHash) {
		return {
			ok: false,
			reason: 'PRECONDITION_FAILED: The package source changed after planning.',
		};
	}

	if (mismatch('packageHash') || plan.packageHash !== currentState.packageHash) {
		return {
			ok: false,
			reason: 'PRECONDITION_FAILED: The resolved package changed after planning.',
		};
	}

	if (mismatch('assetManifestHash')) {
		return {
			ok: false,
			reason: 'PRECONDITION_FAILED: The canonical asset manifest changed after planning.',
		};
	}

	if (
		mismatch('verifiedProjectRef') ||
		plan.verifiedProjectRef !== currentState.verifiedProjectRef
	) {
		return {
			ok: false,
			reason: 'PRECONDITION_FAILED: The verified target project changed after planning.',
		};
	}

	if (mismatch('targetInvitationId')) {
		return {
			ok: false,
			reason: `PRECONDITION_FAILED: Precondition failed: target invitation ID changed (expected ${targetPreconditions.targetInvitationId}, got ${currentState.targetInvitationId}).`,
		};
	}

	if (mismatch('targetOwnerUserId')) {
		return {
			ok: false,
			reason: `PRECONDITION_FAILED: Precondition failed: target owner user ID changed (expected ${targetPreconditions.targetOwnerUserId}, got ${currentState.targetOwnerUserId}).`,
		};
	}

	if (
		targetPreconditions.existingDraftUpdatedAt !== undefined &&
		normalizeTimestamp(targetPreconditions.existingDraftUpdatedAt) !==
			normalizeTimestamp(currentState.existingDraftUpdatedAt)
	) {
		return {
			ok: false,
			reason: `PRECONDITION_FAILED: Precondition failed: target draft updated timestamp changed after planning (expected ${targetPreconditions.existingDraftUpdatedAt}, got ${currentState.existingDraftUpdatedAt}).`,
		};
	}

	if (mismatch('existingPublishedVersion')) {
		return {
			ok: false,
			reason: `PRECONDITION_FAILED: Precondition failed: target published version changed after planning (expected ${targetPreconditions.existingPublishedVersion}, got ${currentState.existingPublishedVersion}).`,
		};
	}

	// NOTE: assetStateHash is intentionally excluded from precondition verification.
	// Storage HTTP probes are non-deterministic across CDN edge nodes; re-probing
	// storage during apply frequently produces a different hash than planning.
	// Asset-level verification is handled by the reconciliation phase in the engine.

	return { ok: true };
}

const SECTION_LABELS: Record<string, string> = {
	envelope: 'Sobre / apertura',
	hero: 'Portada / héroe',
	cover: 'Portada / héroe',
	family: 'Familia',
	event: 'Evento / agenda',
	schedule: 'Evento / agenda',
	locations: 'Ubicación',
	location: 'Ubicación',
	gallery: 'Galería de fotos',
	giftRegistry: 'Mesa de regalos',
	gifts: 'Mesa de regalos',
	rsvp: 'Pase / RSVP',
	music: 'Música de fondo',
	dressCode: 'Código de vestimenta',
	lodging: 'Hospedaje',
	general: 'Información general',
};

const FIELD_LABELS: Record<string, string> = {
	envelopeName: 'Sobre / apertura',
	featuredImage: 'Imagen destacada',
	backgroundImageDesktop: 'Imagen de fondo (escritorio)',
	backgroundImageMobile: 'Imagen de fondo (móvil)',
	labels: 'Etiquetas / textos',
	heroImage: 'Imagen de portada',
	musicUrl: 'Audio de fondo',
	bankName: 'Banco',
	clabe: 'CLABE',
	accountHolder: 'Titular de cuenta',
	accountNumber: 'Número de cuenta',
	registryUrl: 'Enlace de mesa de regalos',
	giftNote: 'Nota de mesa de regalos',
	rsvpTitle: 'Título de RSVP',
	rsvpDeadline: 'Fecha límite de confirmación',
	passCount: 'Número de pases',
	notes: 'Notas de pase',
	dressCodeTitle: 'Título de vestimenta',
	dressCodeText: 'Descripción de vestimenta',
	lodgingTitle: 'Título de hospedaje',
	lodgingText: 'Descripción de hospedaje',
	names: 'Nombre',
	name: 'Nombre',
	title: 'Título',
	subtitle: 'Subtítulo',
	parentsTitle: 'Título de padres',
	parents: 'Nombres de padres',
	godparentsTitle: 'Título de padrinos',
	godparents: 'Nombres de padrinos',
	date: 'Fecha',
	time: 'Hora',
	venue: 'Lugar / Recinto',
	address: 'Dirección',
	message: 'Mensaje',
	phrase: 'Frase / dedicatoria',
	quote: 'Frase / dedicatoria',
	buttonText: 'Texto de botón',
	mapUrl: 'Enlace de mapa',
	googleMapsUrl: 'Enlace de mapa',
	sectionMessage: 'Mensaje de sección',
	sectionTitle: 'Título de sección',
	sectionSubtitle: 'Subtítulo de sección',
	father: 'Padre',
	mother: 'Madre',
	parentsOrder: 'Orden de padres',
};

function humanizeSection(sectionKey: string): string {
	return SECTION_LABELS[sectionKey] || sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
}

function humanizeField(fieldKey: string): string {
	return FIELD_LABELS[fieldKey] || fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
}

const SENSITIVE_FIELD_PATTERN =
	/(password|secret|token|credential|service.?role|authorization|client_?email|client_?whatsapp|accountNumber|clabe)/i;
const TECHNICAL_FIELD_PATTERN =
	/^(id|assetId|src|bucket|storagePath|mimeType|fileSize|width|height|validationVersion|originalMimeType|originalFileSize|createdAt|updatedAt)$/;

function formatValueForDisplay(val: unknown, fieldKey?: string): string {
	if (fieldKey && SENSITIVE_FIELD_PATTERN.test(fieldKey)) return '[REDACTADO]';
	if (val === null || val === undefined || val === '') return '(vacío)';
	if (typeof val === 'string') {
		const sanitized = val
			.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTADO]')
			.replace(/(?:eyJ|sb_(?:secret|publishable)_)[A-Za-z0-9_.-]+/g, '[REDACTADO]');
		return `«${sanitized.trim()}»`;
	}
	if (typeof val === 'number' || typeof val === 'boolean') return String(val);
	if (Array.isArray(val)) {
		if (val.length === 0) return '(vacío)';
		if (val.every((item) => typeof item === 'string' || typeof item === 'number')) {
			return `[${val.map((item) => `«${item}»`).join(', ')}]`;
		}
		return `[${val.length} elemento${val.length === 1 ? '' : 's'}]`;
	}
	if (typeof val === 'object') {
		const obj = val as Record<string, unknown>;
		const entries = Object.entries(obj)
			.filter(([k]) => !k.startsWith('_') && k !== 'photoNotes')
			.map(([k, v]) => `${humanizeField(k)}: ${formatValueForDisplay(v, k)}`);
		if (entries.length > 0 && entries.length <= 5) {
			return `{ ${entries.join(', ')} }`;
		}
		if (entries.length > 5) {
			return `{ ${entries.slice(0, 5).join(', ')}, ... }`;
		}
		return '(definido)';
	}
	return String(val);
}

function canonicalizeValue(val: unknown): unknown {
	if (val === null || val === undefined || val === '') return undefined;
	if (typeof val === 'string') return val.trim() || undefined;
	if (Array.isArray(val)) {
		const arr = val.map(canonicalizeValue).filter((item) => item !== undefined);
		return arr.length > 0 ? arr : undefined;
	}
	if (typeof val === 'object') {
		const obj = val as Record<string, unknown>;
		const res: Record<string, unknown> = {};
		for (const key of Object.keys(obj).sort()) {
			if (key.startsWith('_') || key === 'photoNotes' || TECHNICAL_FIELD_PATTERN.test(key))
				continue;
			const normalized = canonicalizeValue(obj[key]);
			if (normalized !== undefined) res[key] = normalized;
		}
		return Object.keys(res).length > 0 ? res : undefined;
	}
	return val;
}

export function buildSemanticFunctionalChanges(params: {
	sourceContent: Record<string, unknown>;
	targetContent?: Record<string, unknown> | null;
	assetActions?: Array<{ name: string; action: string; detail: string }>;
}): FunctionalChange[] {
	const changes: FunctionalChange[] = [];
	const { sourceContent, targetContent, assetActions = [] } = params;
	const equal = (left: unknown, right: unknown): boolean =>
		JSON.stringify(canonicalizeValue(left)) === JSON.stringify(canonicalizeValue(right));
	const stableItemKey = (value: unknown): string | undefined => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
		const record = value as Record<string, unknown>;
		for (const key of ['key', 'slug', 'name', 'title', 'label']) {
			if (typeof record[key] === 'string' && record[key]) return `${key}:${record[key]}`;
		}
		return undefined;
	};
	const add = (
		section: string,
		fieldPath: string,
		operation: FunctionalOperation,
		previousValue: unknown,
		newValue: unknown,
	): void => {
		const leaf = fieldPath.split('.').at(-1) ?? 'value';
		const entity = leaf === '$order' ? 'Orden' : humanizeField(leaf.replace(/\[[^\]]+\]$/, ''));
		changes.push({
			section,
			entity,
			label: `${section} — ${entity}`,
			operation,
			field: fieldPath,
			previousValue:
				previousValue === undefined
					? undefined
					: formatValueForDisplay(previousValue, leaf),
			newValue: newValue === undefined ? undefined : formatValueForDisplay(newValue, leaf),
			scope: 'database',
			technicalWriteCount: 1,
		});
	};
	const walk = (
		section: string,
		fieldPath: string,
		sourceValue: unknown,
		targetValue: unknown,
		// eslint-disable-next-line complexity -- Recursive semantic diff distinguishes nested objects, keyed collections, scalar collections, and ordering.
	): void => {
		if (equal(sourceValue, targetValue)) return;
		const sourceCanonical = canonicalizeValue(sourceValue);
		const targetCanonical = canonicalizeValue(targetValue);
		if (
			sourceValue &&
			typeof sourceValue === 'object' &&
			!Array.isArray(sourceValue) &&
			targetCanonical === undefined
		) {
			for (const key of Object.keys(sourceValue as Record<string, unknown>).sort()) {
				if (
					key.startsWith('_') ||
					key === 'photoNotes' ||
					TECHNICAL_FIELD_PATTERN.test(key)
				)
					continue;
				walk(
					section,
					fieldPath ? `${fieldPath}.${key}` : key,
					(sourceValue as Record<string, unknown>)[key],
					undefined,
				);
			}
			return;
		}
		if (
			targetValue &&
			typeof targetValue === 'object' &&
			!Array.isArray(targetValue) &&
			sourceCanonical === undefined
		) {
			for (const key of Object.keys(targetValue as Record<string, unknown>).sort()) {
				if (
					key.startsWith('_') ||
					key === 'photoNotes' ||
					TECHNICAL_FIELD_PATTERN.test(key)
				)
					continue;
				walk(
					section,
					fieldPath ? `${fieldPath}.${key}` : key,
					undefined,
					(targetValue as Record<string, unknown>)[key],
				);
			}
			return;
		}
		if (
			Array.isArray(sourceValue) &&
			!Array.isArray(targetValue) &&
			targetCanonical === undefined
		) {
			walk(section, fieldPath, sourceValue, []);
			return;
		}
		if (
			Array.isArray(targetValue) &&
			!Array.isArray(sourceValue) &&
			sourceCanonical === undefined
		) {
			walk(section, fieldPath, [], targetValue);
			return;
		}
		if (targetCanonical === undefined) {
			add(section, fieldPath, 'insert', undefined, sourceValue);
			return;
		}
		if (sourceCanonical === undefined) {
			add(section, fieldPath, 'delete', targetValue, undefined);
			return;
		}
		if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
			const sourceKeys = sourceValue.map(stableItemKey);
			const targetKeys = targetValue.map(stableItemKey);
			if (sourceKeys.every(Boolean) && targetKeys.every(Boolean)) {
				const sourceMap = new Map(
					sourceKeys.map((key, index) => [key!, sourceValue[index]]),
				);
				const targetMap = new Map(
					targetKeys.map((key, index) => [key!, targetValue[index]]),
				);
				for (const key of [...new Set([...sourceMap.keys(), ...targetMap.keys()])].sort()) {
					walk(
						section,
						`${fieldPath}[${key.split(':').slice(1).join(':')}]`,
						sourceMap.get(key),
						targetMap.get(key),
					);
				}
				if (
					sourceKeys.length === targetKeys.length &&
					[...sourceKeys].sort().join('|') === [...targetKeys].sort().join('|') &&
					sourceKeys.join('|') !== targetKeys.join('|')
				) {
					add(section, `${fieldPath}.$order`, 'move', targetKeys, sourceKeys);
				}
				return;
			}
			const sourceItems = sourceValue.map((item) => JSON.stringify(canonicalizeValue(item)));
			const targetItems = targetValue.map((item) => JSON.stringify(canonicalizeValue(item)));
			for (const [index, item] of targetItems.entries()) {
				if (!sourceItems.includes(item))
					add(section, `${fieldPath}[${index}]`, 'delete', targetValue[index], undefined);
			}
			for (const [index, item] of sourceItems.entries()) {
				if (!targetItems.includes(item))
					add(section, `${fieldPath}[${index}]`, 'insert', undefined, sourceValue[index]);
			}
			if (
				sourceItems.length === targetItems.length &&
				[...sourceItems].sort().join('|') === [...targetItems].sort().join('|') &&
				sourceItems.join('|') !== targetItems.join('|')
			) {
				add(section, `${fieldPath}.$order`, 'move', targetValue, sourceValue);
			}
			return;
		}
		if (
			sourceValue &&
			targetValue &&
			typeof sourceValue === 'object' &&
			typeof targetValue === 'object' &&
			!Array.isArray(sourceValue) &&
			!Array.isArray(targetValue)
		) {
			const sourceRecord = sourceValue as Record<string, unknown>;
			const targetRecord = targetValue as Record<string, unknown>;
			for (const key of [
				...new Set([...Object.keys(sourceRecord), ...Object.keys(targetRecord)]),
			].sort()) {
				if (
					key.startsWith('_') ||
					key === 'photoNotes' ||
					TECHNICAL_FIELD_PATTERN.test(key)
				)
					continue;
				walk(
					section,
					fieldPath ? `${fieldPath}.${key}` : key,
					sourceRecord[key],
					targetRecord[key],
				);
			}
			return;
		}
		add(section, fieldPath, 'update', targetValue, sourceValue);
	};

	for (const sectionKey of [
		...new Set([...Object.keys(sourceContent), ...Object.keys(targetContent ?? {})]),
	].sort()) {
		if (sectionKey.startsWith('_') || sectionKey === 'photoNotes') continue;
		walk(
			humanizeSection(sectionKey),
			sectionKey,
			sourceContent[sectionKey],
			targetContent?.[sectionKey],
		);
	}

	// Process storage asset actions
	for (const action of assetActions) {
		if (action.action === 'create') {
			changes.push({
				section: 'Storage',
				entity: action.name,
				label: `Subida: ${action.name}`,
				operation: 'upload',
				newValue: action.detail,
				scope: 'storage',
				technicalWriteCount: 1,
			});
		} else if (action.action === 'replace') {
			changes.push({
				section: 'Storage',
				entity: action.name,
				label: `Sobrescritura: ${action.name}`,
				operation: 'overwrite',
				previousValue: 'Versión previa',
				newValue: action.detail,
				scope: 'storage',
				technicalWriteCount: 1,
			});
		} else if (action.action === 'delete') {
			changes.push({
				section: 'Storage',
				entity: action.name,
				label: `Eliminación: ${action.name}`,
				operation: 'delete',
				previousValue: action.name,
				scope: 'storage',
				technicalWriteCount: 1,
			});
		}
	}

	const seen = new Set<string>();
	return changes.filter((change) => {
		const key = JSON.stringify([
			change.scope,
			change.operation,
			change.section,
			change.field,
			change.previousValue,
			change.newValue,
		]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
