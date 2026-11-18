#!/usr/bin/env node
/**
 * scripts/ops/preview-readiness.ts
 *
 * Pre-release readiness report: checks Preview schema compatibility and validates
 * that release invitations have a current, valid Preview approval artifact.
 *
 * Designed to run:
 *   1. Locally / in Preview lane by the agent before opening a release PR to `main`.
 *   2. In CI or unauthenticated environments where Preview credentials are unavailable,
 *      reporting "sin dato" gracefully without failing the build.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { flagValue } from '../lib/cli-args.ts';
import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	resolveTargetDbUrl,
} from '../db/db-target-config.ts';
import { findRepoRoot } from '../shared/worktree-lane.ts';
import {
	evaluatePromotionSchemaGate,
	type PromotionSchemaGateResult,
} from '../provision/invitation-promote.ts';
import {
	createPreviewDbApprovalStore,
	type PreviewApprovalStore,
} from '../provision/preview-approval-store.ts';
import {
	PreviewApprovalError,
	verifyPreviewApprovalArtifact,
} from '../provision/preview-approval-service.ts';
import { resolveInvitationPackageInput } from '../provision/invitation-package-input.ts';
import { CLIENT_INVITATION_DEFINITIONS } from '../provision/invitations/client-registry.generated.ts';

export type InvitationPreviewApprovalState = 'lista' | 'falta' | 'vencida' | 'sin dato';

export interface InvitationPreviewReadinessItem {
	slug: string;
	route: string;
	packageHash: string;
	state: InvitationPreviewApprovalState;
	approvalFound: string;
	validity: string;
	detail?: string;
	approvedAt?: string | null;
	approvedBy?: string | null;
	latestApprovedPackageHash?: string | null;
}

export interface PreviewReadinessSummary {
	total: number;
	lista: number;
	falta: number;
	vencida: number;
	sinDato: number;
	schemaCompatible: boolean;
	readyForProduction: boolean;
	blockedReasons: string[];
}

export interface PreviewReadinessReport {
	schema: PromotionSchemaGateResult;
	invitations: InvitationPreviewReadinessItem[];
	summary: PreviewReadinessSummary;
	previewDbConfigured: boolean;
	evaluationTimestamp: string;
}

export interface PreviewReadinessOptions {
	slugs?: string[];
	base?: string;
	head?: string;
	all?: boolean;
	dbUrl?: string;
	now?: Date;
	json?: boolean;
	strict?: boolean;
}

export interface PreviewReadinessDeps {
	store?: PreviewApprovalStore;
	previewDbUrl?: string;
	evaluateSchema?: typeof evaluatePromotionSchemaGate;
	resolvePackage?: typeof resolveInvitationPackageInput;
	gitDiffFiles?: (base: string, head: string) => string[];
	clientDefinitions?: readonly { slug: string; eventType?: string }[];
}

const PREVIEW_APPROVAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolve effective Preview database URL from flags, environment, canonical secret files,
 * or the repository root checkout if running in a worktree.
 */
export function resolveEffectivePreviewDbUrl(explicitUrl?: string): string {
	if (explicitUrl?.trim()) return explicitUrl.trim();
	const direct = resolveTargetDbUrl('preview');
	if (direct) return direct;

	try {
		const repoRoot = findRepoRoot(process.cwd());
		if (repoRoot && repoRoot !== process.cwd()) {
			const candidateFile = resolve(repoRoot, '.env.preview.local');
			if (existsSync(candidateFile)) {
				const fromRoot = getSecretFromEnvOrFiles('PREVIEW_DB_URL', [candidateFile]);
				if (fromRoot) return fromRoot;
			}
		}
	} catch {
		// Ignore path discovery failures
	}
	return '';
}

/**
 * Extract invitation slugs touched within a Git revision range.
 */
export function extractInvitationSlugsFromPaths(
	paths: string[],
	knownSlugs: readonly string[],
): string[] {
	const matched = new Set<string>();
	const knownSet = new Set(knownSlugs);

	for (const rawPath of paths) {
		const normalized = rawPath.replace(/\\/g, '/');

		const clientMatch = normalized.match(/^src\/invitations\/clients\/([^/]+)\//);
		if (clientMatch?.[1]) {
			matched.add(clientMatch[1]);
			continue;
		}

		const legacyMatch = normalized.match(/^scripts\/provision\/invitations\/([^/]+)\.ts$/);
		if (legacyMatch?.[1] && knownSet.has(legacyMatch[1])) {
			matched.add(legacyMatch[1]);
			continue;
		}

		const assetMatch = normalized.match(/^src\/assets\/invitations\/([^/]+)\//);
		if (assetMatch?.[1] && knownSet.has(assetMatch[1])) {
			matched.add(assetMatch[1]);
			continue;
		}

		const profileMatch = normalized.match(/^src\/styles\/invitation-profiles\/([^/]+)\//);
		if (profileMatch?.[1] && knownSet.has(profileMatch[1])) {
			matched.add(profileMatch[1]);
			continue;
		}
	}

	return [...matched].sort();
}

/**
 * Resolves the target slugs to audit based on explicit options, git range, or default all.
 */
export function resolveAuditSlugs(
	options: PreviewReadinessOptions,
	deps: PreviewReadinessDeps = {},
): string[] {
	const allClientSlugs = (deps.clientDefinitions ?? CLIENT_INVITATION_DEFINITIONS).map(
		(def) => def.slug,
	);

	if (options.slugs && options.slugs.length > 0) {
		return [...new Set(options.slugs.flatMap((s) => s.split(',')).map((s) => s.trim()))].filter(
			Boolean,
		);
	}

	if (options.base && options.head) {
		const diffFiles =
			deps.gitDiffFiles ??
			((base: string, head: string) => {
				const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
					encoding: 'utf8',
				});
				return output.split(/\r?\n/).filter(Boolean);
			});
		const changedPaths = diffFiles(options.base, options.head);
		return extractInvitationSlugsFromPaths(changedPaths, allClientSlugs);
	}

	return [...allClientSlugs].sort();
}

function handlePreviewApprovalError(
	error: PreviewApprovalError,
	packageHash: string,
	shortHash: string,
	store: PreviewApprovalStore,
	now: Date,
): Pick<
	InvitationPreviewReadinessItem,
	| 'state'
	| 'approvalFound'
	| 'validity'
	| 'detail'
	| 'latestApprovedPackageHash'
	| 'approvedAt'
	| 'approvedBy'
> {
	if (error.reason === 'EXPIRED') {
		const rawArtifact = store.get(packageHash);
		const approvedAtMs = rawArtifact?.approvedAt ? Date.parse(rawArtifact.approvedAt) : NaN;
		const daysAgo = !isNaN(approvedAtMs)
			? Math.max(0, Math.floor((now.getTime() - approvedAtMs) / 86400000))
			: '>7';
		return {
			state: 'vencida',
			approvalFound: `exacta (${shortHash})`,
			validity: `vencida (aprobada ${rawArtifact?.approvedAt ?? 'hace >7 d'}, hace ${daysAgo} d)`,
			detail: error.message,
			approvedAt: rawArtifact?.approvedAt,
			approvedBy: rawArtifact?.approvedBy,
		};
	}

	if (error.reason === 'APPROVED_OTHER_HASH') {
		const latest = error.latestApprovedForSlug;
		const shortOther = latest?.packageHash ? `${latest.packageHash.slice(0, 12)}…` : 'otro';
		return {
			state: 'falta',
			approvalFound: `otro hash (${shortOther})`,
			validity: `desactualizada (aprobada para otro hash el ${latest?.approvedAt ?? 'n/a'})`,
			detail: error.message,
			latestApprovedPackageHash: latest?.packageHash,
			approvedAt: latest?.approvedAt,
		};
	}

	if (error.reason === 'NEVER_APPROVED') {
		return {
			state: 'falta',
			approvalFound: 'ninguna',
			validity: 'sin aprobación en Preview',
			detail: error.message,
		};
	}

	if (error.reason === 'PENDING_HOSTED_VALIDATION') {
		return {
			state: 'falta',
			approvalFound: `exacta (${shortHash})`,
			validity: 'pendiente de validación en Preview',
			detail: error.message,
		};
	}

	return {
		state: 'falta',
		approvalFound: `inválida (${error.reason})`,
		validity: 'aprobación no coincide con la release exacta',
		detail: error.message,
	};
}

/**
 * Audit an individual invitation slug against the preview approval store.
 */
export async function auditInvitationApproval(
	slug: string,
	options: {
		store: PreviewApprovalStore | null;
		now: Date;
		resolvePackage?: typeof resolveInvitationPackageInput;
	},
): Promise<InvitationPreviewReadinessItem> {
	const resolvePkg = options.resolvePackage ?? resolveInvitationPackageInput;
	let packageData;

	try {
		const resolved = await resolvePkg({ slug });
		packageData = resolved.packageData;
	} catch (error) {
		return {
			slug,
			route: `/invitacion/${slug}`,
			packageHash: 'n/a',
			state: 'falta',
			approvalFound: 'error',
			validity: 'error al resolver paquete',
			detail: error instanceof Error ? error.message : String(error),
		};
	}

	const route = `/${packageData.invitation.eventType}/${packageData.invitation.slug}`;
	const currentPackageHash = packageData.packageHash;
	const shortCurrentHash = `${currentPackageHash.slice(0, 12)}…`;

	if (!options.store) {
		return {
			slug,
			route,
			packageHash: currentPackageHash,
			state: 'sin dato',
			approvalFound: 'sin dato',
			validity: 'sin dato (sin acceso a Preview DB)',
			detail: 'Credenciales de Preview DB no disponibles en este entorno.',
		};
	}

	const identity = {
		packageHash: packageData.packageHash,
		sourceHash: packageData.sourceHash,
		metadataHash: packageData.metadataHash,
		projectionHash: packageData.projectionHash,
		assetManifestHash: packageData.assetManifestHash,
		slug: packageData.invitation.slug,
		route,
	};

	try {
		const artifact = verifyPreviewApprovalArtifact(identity, {
			store: options.store,
			now: options.now,
		});

		const approvedAtMs = Date.parse(artifact.approvedAt ?? '');
		const daysAgo = Math.max(0, Math.floor((options.now.getTime() - approvedAtMs) / 86400000));
		const expiryDate = new Date(approvedAtMs + PREVIEW_APPROVAL_MAX_AGE_MS)
			.toISOString()
			.slice(0, 10);

		return {
			slug,
			route,
			packageHash: currentPackageHash,
			state: 'lista',
			approvalFound: `exacta (${shortCurrentHash})`,
			validity: `vigente (hace ${daysAgo} d / vence ${expiryDate})`,
			approvedAt: artifact.approvedAt,
			approvedBy: artifact.approvedBy,
		};
	} catch (error) {
		if (error instanceof PreviewApprovalError) {
			const outcome = handlePreviewApprovalError(
				error,
				currentPackageHash,
				shortCurrentHash,
				options.store,
				options.now,
			);
			return { slug, route, packageHash: currentPackageHash, ...outcome };
		}

		return {
			slug,
			route,
			packageHash: currentPackageHash,
			state: 'sin dato',
			approvalFound: 'sin dato',
			validity: 'error al consultar aprobación',
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

function evaluateSchemaForReadiness(
	previewDbUrl: string,
	evaluateSchema?: typeof evaluatePromotionSchemaGate,
): PromotionSchemaGateResult {
	if (!previewDbUrl) {
		return {
			state: 'UNVERIFIED',
			migrationHead: null,
			pendingMigrations: [],
			extraMigrations: [],
			compatible: false,
			blockCode: 'SCHEMA_INCOMPATIBLE',
			detail: 'sin dato (credenciales de Preview DB no disponibles en este entorno)',
		};
	}
	const evalFn = evaluateSchema ?? evaluatePromotionSchemaGate;
	return evalFn({ dbUrl: previewDbUrl });
}

function computeReadinessSummary(
	items: readonly InvitationPreviewReadinessItem[],
	schemaResult: PromotionSchemaGateResult,
	previewDbConfigured: boolean,
): PreviewReadinessSummary {
	const lista = items.filter((i) => i.state === 'lista').length;
	const falta = items.filter((i) => i.state === 'falta').length;
	const vencida = items.filter((i) => i.state === 'vencida').length;
	const sinDato = items.filter((i) => i.state === 'sin dato').length;

	const blockedReasons: string[] = [];
	if (previewDbConfigured && !schemaResult.compatible) {
		blockedReasons.push(`Esquema Preview no compatible: ${schemaResult.detail}`);
	}
	for (const item of items) {
		if (item.state === 'falta' || item.state === 'vencida') {
			blockedReasons.push(`${item.slug}: ${item.state.toUpperCase()} (${item.validity})`);
		}
	}

	const schemaCompatible = previewDbConfigured ? schemaResult.compatible : false;
	const readyForProduction =
		schemaCompatible && items.length > 0 && items.every((i) => i.state === 'lista');

	return {
		total: items.length,
		lista,
		falta,
		vencida,
		sinDato,
		schemaCompatible,
		readyForProduction,
		blockedReasons,
	};
}

function resolveSanitizedPreviewDbUrl(
	optionsDbUrl?: string,
	depsDbUrl?: string,
): { previewDbUrl: string; previewDbConfigured: boolean } {
	const rawDbUrl = depsDbUrl ?? resolveEffectivePreviewDbUrl(optionsDbUrl);
	if (!rawDbUrl) {
		return { previewDbUrl: '', previewDbConfigured: false };
	}
	try {
		const classification = classifyDbTarget(rawDbUrl);
		if (classification.target === 'production') {
			throw new Error('Refusing to run preview readiness against Production database URL.');
		}
		return { previewDbUrl: rawDbUrl, previewDbConfigured: true };
	} catch (error) {
		if (error instanceof Error && error.message.includes('Production database URL')) {
			throw error;
		}
		return { previewDbUrl: '', previewDbConfigured: false };
	}
}

/**
 * Main evaluation entry point.
 */
export async function evaluatePreviewReadiness(
	options: PreviewReadinessOptions = {},
	deps: PreviewReadinessDeps = {},
): Promise<PreviewReadinessReport> {
	const now = options.now ?? new Date();
	const { previewDbUrl, previewDbConfigured } = resolveSanitizedPreviewDbUrl(
		options.dbUrl,
		deps.previewDbUrl,
	);

	const schemaResult = evaluateSchemaForReadiness(previewDbUrl, deps.evaluateSchema);
	const targetSlugs = resolveAuditSlugs(options, deps);

	let store: PreviewApprovalStore | null = deps.store ?? null;
	if (!store && previewDbUrl) {
		try {
			store = createPreviewDbApprovalStore({ getDbUrl: () => previewDbUrl });
		} catch {
			store = null;
		}
	}

	const items: InvitationPreviewReadinessItem[] = [];
	for (const slug of targetSlugs) {
		items.push(
			await auditInvitationApproval(slug, {
				store,
				now,
				resolvePackage: deps.resolvePackage,
			}),
		);
	}

	const summary = computeReadinessSummary(items, schemaResult, previewDbConfigured);

	return {
		schema: schemaResult,
		invitations: items,
		summary,
		previewDbConfigured,
		evaluationTimestamp: now.toISOString(),
	};
}

/**
 * Format report in GitHub Flavored Markdown for PR bodies and console reading.
 */
export function formatPreviewReadinessReport(report: PreviewReadinessReport): string {
	const lines: string[] = [];

	lines.push('### Reporte de Preview Readiness (Pre-Release)');
	lines.push('');

	if (!report.previewDbConfigured) {
		lines.push(
			'**Esquema Preview:** sin dato (credenciales de Preview no disponibles en este entorno)',
		);
	} else if (report.schema.compatible) {
		const head = report.schema.migrationHead ?? 'ninguno';
		lines.push(`**Esquema Preview:** CURRENT (head: \`${head}\`, 0 pendientes) · compatible`);
	} else {
		const pendingStr =
			report.schema.pendingMigrations.length > 0
				? ` (${report.schema.pendingMigrations.length} pendientes: ${report.schema.pendingMigrations.join(', ')})`
				: '';
		lines.push(
			`**Esquema Preview:** ⚠️ ${report.schema.state}${pendingStr} · ${report.schema.detail}`,
		);
	}
	lines.push('');

	if (report.invitations.length === 0) {
		lines.push('_No se encontraron invitaciones administradas en el alcance indicado._');
	} else {
		lines.push('| Invitación | Estado | Hash Actual | Aprobación Encontrada | Vigencia |');
		lines.push('| --- | --- | --- | --- | --- |');
		for (const inv of report.invitations) {
			const shortHash =
				inv.packageHash.length >= 12
					? `\`${inv.packageHash.slice(0, 12)}…\``
					: inv.packageHash;
			const estadoEmoji =
				inv.state === 'lista'
					? '✅ lista'
					: inv.state === 'falta'
						? '❌ falta'
						: inv.state === 'vencida'
							? '⏰ vencida'
							: '❔ sin dato';
			lines.push(
				`| ${inv.slug} | ${estadoEmoji} | ${shortHash} | ${inv.approvalFound} | ${inv.validity} |`,
			);
		}
	}
	lines.push('');

	const s = report.summary;
	lines.push(
		`**Resumen:** ${s.lista} listas, ${s.falta} falta, ${s.vencida} vencidas, ${s.sinDato} sin dato (total: ${s.total}).`,
	);

	if (s.blockedReasons.length > 0) {
		lines.push('');
		lines.push('**Bloqueos para Producción detectados antes de la ventana:**');
		for (const reason of s.blockedReasons) {
			lines.push(`- ⚠️ ${reason}`);
		}
	} else if (s.readyForProduction) {
		lines.push('');
		lines.push(
			'**Veredicto:** ✅ Todas las invitaciones tienen aprobación de Preview vigente y el esquema es compatible.',
		);
	} else if (!report.previewDbConfigured) {
		lines.push('');
		lines.push(
			'**Veredicto:** ℹ️ Sin conexión a Preview DB. Ejecute en un entorno con acceso a Preview antes de abrir la ventana.',
		);
	}

	return lines.join('\n');
}

/**
 * CLI parser and runner.
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);

	const slugs: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--slug' && args[i + 1] && !args[i + 1].startsWith('--')) {
			slugs.push(args[i + 1]);
		}
	}

	const base = flagValue(args, '--base') ?? process.env.VALIDATION_BASE_SHA;
	const head = flagValue(args, '--head') ?? process.env.VALIDATION_HEAD_SHA;
	const all = args.includes('--all');
	const json = args.includes('--json');
	const strict = args.includes('--strict') || args.includes('--fail-on-blocked');
	const dbUrl = flagValue(args, '--db-url') ?? flagValue(args, '--preview-db-url');
	const nowStr = flagValue(args, '--now');
	const now = nowStr ? new Date(nowStr) : new Date();

	const report = await evaluatePreviewReadiness({
		slugs: slugs.length > 0 ? slugs : undefined,
		base,
		head,
		all: all || (slugs.length === 0 && !base && !head),
		dbUrl,
		now,
		json,
		strict,
	});

	if (json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(formatPreviewReadinessReport(report));
	}

	if (
		strict &&
		(report.summary.falta > 0 ||
			report.summary.vencida > 0 ||
			(report.previewDbConfigured && !report.summary.schemaCompatible))
	) {
		process.exitCode = 1;
	}
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /preview-readiness\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	main().catch((err) => {
		console.error('Error running preview-readiness:', err);
		process.exit(1);
	});
}
