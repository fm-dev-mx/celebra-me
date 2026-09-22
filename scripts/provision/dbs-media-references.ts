/** Fast, read-only published media reference status for the dbs operator CLI. */
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import { buildCloudinaryOgImageUrl } from '../../src/lib/intake/services/cloudinary-assets.ts';
import type { OperationalActionPlan } from '../../src/lib/status/action-plan.ts';
import type {
	MediaReferenceEnvironment,
	MediaReferenceEnvironmentStatus,
	MediaReferenceFinding,
	MediaReferencesStatus,
} from '../../src/lib/status/media-reference-types.ts';
import { runPsql, sqlLiteral, validateEnvironmentUrlsPreflight } from '../db/db-workflow-lib.ts';
import { useCliColor } from '../db/operator-cli-ux.ts';
import { resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';

export interface PublishedMediaInventoryRow {
	eventType: string;
	slug: string;
	content: Record<string, unknown>;
	assets: Array<{ id: string; key: string | null; url: string | null }>;
}

const EMPTY_UNVERIFIED: MediaReferenceEnvironmentStatus = {
	status: 'UNVERIFIED',
	invitations: 0,
	references: 0,
	findings: [],
};

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_PATH = /^[a-zA-Z0-9_.[\]-]{1,160}$/u;
const SAFE_KEY = /^[a-zA-Z0-9_-]{1,120}$/u;

function safeLabel(value: string, pattern: RegExp): string {
	return pattern.test(value) ? value : '[redacted]';
}

function validHostedDeliveryUrl(value: string | null): boolean {
	try {
		const url = new URL(value ?? '');
		return (
			url.protocol === 'https:' &&
			url.hostname === 'res.cloudinary.com' &&
			url.pathname.includes('/image/upload/')
		);
	} catch {
		return false;
	}
}

/** Compare physical reference identity only; no provider requests or binary reads. */
export function inspectPublishedMediaReferences(
	rows: readonly PublishedMediaInventoryRow[],
): MediaReferenceEnvironmentStatus {
	if (rows.length === 0) return { ...EMPTY_UNVERIFIED };
	const findings: MediaReferenceFinding[] = [];
	let references = 0;
	for (const row of rows) {
		const slug = safeLabel(row.slug, SAFE_SLUG);
		const route = `${safeLabel(row.eventType, SAFE_SLUG)}/${slug}`;
		const assets = new Map(row.assets.map((asset) => [asset.id, asset]));
		for (const ref of collectUploadedContentRefs(row.content)) {
			references++;
			const asset = assets.get(ref.assetId);
			const base = {
				route,
				slug,
				path: safeLabel(ref.path, SAFE_PATH),
				assetKey: safeLabel(asset?.key ?? ref.assetId, SAFE_KEY),
			};
			if (!asset || !validHostedDeliveryUrl(asset.url)) {
				findings.push({ ...base, issue: 'MISSING_ASSET' });
				continue;
			}
			const expected =
				ref.path === 'sharing.ogImage'
					? buildCloudinaryOgImageUrl(asset.url as string)
					: asset.url;
			if (!ref.src || ref.src !== expected) {
				findings.push({ ...base, issue: 'REFERENCE_DRIFT' });
			}
		}
	}
	findings.sort((a, b) =>
		`${a.route}/${a.path}/${a.assetKey}`.localeCompare(`${b.route}/${b.path}/${b.assetKey}`),
	);
	return {
		status: findings.some((finding) => finding.issue === 'MISSING_ASSET')
			? 'MISSING_ASSET'
			: findings.length > 0
				? 'REFERENCE_DRIFT'
				: 'MATCH',
		invitations: rows.length,
		references,
		findings,
	};
}

function readPublishedMediaInventory(
	target: MediaReferenceEnvironment,
	slug?: string,
): PublishedMediaInventoryRow[] | null {
	const { dbUrl } = resolveDbUrlForEnv(target);
	if (!dbUrl) return null;
	validateEnvironmentUrlsPreflight({ target, targetDbUrl: dbUrl });
	const slugFilter = slug ? `and i.slug = ${sqlLiteral(slug)}` : '';
	const sql = `select coalesce(json_agg(row_to_json(t) order by t."eventType", t.slug), '[]'::json)::text from (
		select i.event_type as "eventType", i.slug, pub.content,
		coalesce((select json_agg(json_build_object(
			'id', a.id::text, 'key', a.managed_source_key, 'url', a.secure_url)
			order by a.managed_source_key, a.id) from public.invitation_assets a
			where a.invitation_id = i.id and a.deleted_at is null), '[]'::json) as assets
		from public.invitations i join lateral (
			select content from public.published_invitation_content
			where invitation_project_id = i.id and deleted_at is null order by version desc limit 1
		) pub on true where i.kind = 'client' and i.archived_at is null ${slugFilter}
	) t;`;
	const result = runPsql(sql, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs: 15_000,
	});
	if (result.status !== 0 || !result.stdout.trim()) return null;
	const parsed: unknown = JSON.parse(result.stdout.trim());
	if (!Array.isArray(parsed)) return null;
	return parsed as PublishedMediaInventoryRow[];
}

export function readMediaReferencesStatus(
	input: {
		targets?: readonly TargetEnv[];
		slug?: string;
		readInventory?: (
			target: MediaReferenceEnvironment,
			slug?: string,
		) => PublishedMediaInventoryRow[] | null;
	} = {},
): MediaReferencesStatus {
	const selected = input.targets ?? ['local', 'preview', 'production'];
	const status: MediaReferencesStatus = { preview: null, production: null };
	for (const target of ['preview', 'production'] as const) {
		if (!selected.includes(target)) continue;
		try {
			const rows = (input.readInventory ?? readPublishedMediaInventory)(target, input.slug);
			status[target] = rows ? inspectPublishedMediaReferences(rows) : { ...EMPTY_UNVERIFIED };
		} catch {
			status[target] = { ...EMPTY_UNVERIFIED };
		}
	}
	return status;
}

export function mediaReferenceCommands(target: MediaReferenceEnvironment, slug: string): string[] {
	if (!SAFE_SLUG.test(slug)) return [];
	const diagnose = `pnpm invitation:media:verify -- --target ${target} --slug ${slug} --json`;
	const plan =
		target === 'production'
			? `pnpm prod:apply -- --slug ${slug}`
			: `pnpm invitation:release -- --slug ${slug} --targets preview --dry-run`;
	const apply =
		target === 'production'
			? `pnpm prod:apply -- --slug ${slug} --apply`
			: `pnpm invitation:release -- --slug ${slug} --targets preview --apply`;
	return [diagnose, plan, apply];
}

export function buildMediaOperationalPlan(
	base: OperationalActionPlan,
	media: MediaReferencesStatus,
): OperationalActionPlan {
	const actions = [...base.actions];
	let applicableChecks = base.health.applicableChecks;
	for (const target of ['preview', 'production'] as const) {
		const status = media[target];
		if (!status) continue;
		applicableChecks++;
		const bySlug = new Map<string, MediaReferenceFinding[]>();
		for (const finding of status.findings) {
			bySlug.set(finding.slug, [...(bySlug.get(finding.slug) ?? []), finding]);
		}
		for (const [slug, findings] of [...bySlug].sort(([a], [b]) => a.localeCompare(b))) {
			const [diagnose, plan, apply] = mediaReferenceCommands(target, slug);
			const missingAsset = findings.some((finding) => finding.issue === 'MISSING_ASSET');
			actions.push({
				id: `media-${target}-${slug}`,
				domain: 'media',
				title: `Imágenes · ${target}/${slug}`,
				summary: `${findings.length} referencia(s) requieren verificación completa.`,
				semantic: 'blocked',
				priority: 0,
				environments: [target],
				subject: slug,
				steps:
					diagnose && plan && apply
						? [
								{
									type: 'Diagnose',
									label: 'Verificar entrega',
									command: diagnose,
									prerequisite: null,
									requiresOwner: false,
									optional: false,
								},
								...(!missingAsset
									? [
											{
												type: 'Plan',
												label: 'Revisar plan',
												command: plan,
												prerequisite:
													'Solo si los objetos activos pasan HTTP, MIME, dimensiones y SHA-256.',
												requiresOwner: false,
												optional: false,
											} as const,
										]
									: []),
								...(!missingAsset
									? [
											{
												type: 'Apply',
												label: 'Aplicar con autorización',
												command: apply,
												prerequisite:
													'Solo si el diagnóstico atribuye todas las fallas al src publicado y el plan está READY. Si falta un objeto o diverge el hash, use un manifiesto revisado; no aplique.',
												requiresOwner: true,
												optional: false,
											} as const,
										]
									: []),
								...(missingAsset
									? [
											{
												type: 'Manual/HITL',
												label: 'Recuperar asset mediante manifiesto revisado',
												command: null,
												prerequisite:
													'Falta una fila activa; no aplicar promoción directa.',
												requiresOwner: true,
												optional: false,
											} as const,
										]
									: []),
							]
						: [
								{
									type: 'Manual/HITL',
									label: 'Revisar identidad de ruta',
									command: null,
									prerequisite:
										'El slug publicado no es seguro para un comando automático.',
									requiresOwner: true,
									optional: false,
								},
							],
				verifyWhen: `La auditoría completa de ${target}/${slug} termina sin fallos.`,
				why: 'La paridad semántica no valida las URLs físicas publicadas.',
				noCanonicalRemediation: !diagnose,
				deploymentPrerequisite: 'NO',
				deploymentStatus: 'NOT_APPLICABLE',
				executionOrder: 65,
			});
		}
		if (status.status === 'UNVERIFIED') {
			actions.push({
				id: `media-${target}-unverified`,
				domain: 'media',
				title: `Imágenes · ${target}`,
				summary: 'No se pudo leer el inventario publicado; no se conocen las diferencias.',
				semantic: 'unverified',
				priority: 1,
				environments: [target],
				subject: null,
				steps: [
					{
						type: 'Diagnose',
						label: 'Repetir auditoría',
						command: `pnpm invitation:media:verify -- --target ${target} --all --json`,
						prerequisite: null,
						requiresOwner: false,
						optional: false,
					},
				],
				verifyWhen: 'El inventario publicado se lee correctamente.',
				why: null,
				noCanonicalRemediation: false,
				deploymentPrerequisite: 'NO',
				deploymentStatus: 'NOT_APPLICABLE',
				executionOrder: 65,
			});
		}
	}
	const hasDrift = actions.some(
		(action) => action.domain === 'media' && action.semantic === 'blocked',
	);
	const status = hasDrift
		? 'ACTION_REQUIRED'
		: base.health.status === 'GREEN' &&
			  actions.some(
					(action) => action.domain === 'media' && action.semantic === 'unverified',
			  )
			? 'UNVERIFIED'
			: base.health.status;
	return {
		health: {
			...base.health,
			status,
			label:
				status === 'ACTION_REQUIRED'
					? 'Acciones necesarias'
					: status === 'UNVERIFIED'
						? 'Verificación pendiente'
						: base.health.label,
			summary:
				status === 'GREEN'
					? base.health.summary
					: `${actions.length} acción(es) priorizada(s) para alcanzar un estado operativo verde.`,
			applicableChecks,
			unresolvedChecks: actions.length,
		},
		actions: actions.sort(
			(a, b) =>
				a.executionOrder - b.executionOrder ||
				a.priority - b.priority ||
				a.title.localeCompare(b.title, 'es'),
		),
	};
}

function formatMediaDetail(
	target: MediaReferenceEnvironment,
	status: MediaReferenceEnvironmentStatus,
): string[] {
	const lines: string[] = [];
	for (const finding of status.findings)
		lines.push(`    ${finding.path} · ${finding.assetKey} · ${finding.issue}`);
	for (const slug of [...new Set(status.findings.map((finding) => finding.slug))].sort()) {
		const [diagnose, plan, apply] = mediaReferenceCommands(target, slug);
		if (!diagnose || !plan || !apply) {
			lines.push(`  ${slug}: revisar identidad de ruta; sin comando automático.`);
			continue;
		}
		lines.push(`  Diagnosticar ${slug}: ${diagnose}`);
		if (
			status.findings.some(
				(finding) => finding.slug === slug && finding.issue === 'MISSING_ASSET',
			)
		) {
			lines.push(
				'  Falta una fila activa: recuperación con manifiesto revisado; no aplicar promoción directa.',
			);
			continue;
		}
		lines.push(`  Si solo falla el src publicado y los objetos están íntegros: ${plan}`);
		lines.push(`  Con plan READY y autorización del propietario: ${apply}`);
		lines.push(
			'  Si falta un objeto o diverge el hash: manifiesto revisado; no aplicar la promoción.',
		);
	}
	if (status.status === 'UNVERIFIED')
		lines.push(`  Reintentar: pnpm invitation:media:verify -- --target ${target} --all --json`);
	return lines;
}

export function formatMediaReferences(
	media: MediaReferencesStatus,
	options: { verbose?: boolean; slug?: string; env?: NodeJS.ProcessEnv } = {},
): string {
	const color = useCliColor(options.env);
	const paint = (code: number, value: string) => (color ? `\x1b[${code}m${value}\x1b[0m` : value);
	const lines = ['', paint(1, 'IMÁGENES · referencias publicadas')];
	for (const target of ['preview', 'production'] as const) {
		const status = media[target];
		if (!status) continue;
		const affected = new Set(status.findings.map((finding) => finding.route)).size;
		const state =
			status.status === 'MATCH'
				? paint(32, '✓ Correctas')
				: status.status === 'UNVERIFIED'
					? paint(33, '⚠ Sin verificar')
					: paint(31, '✗ Revisar');
		lines.push(
			`  ${target === 'production' ? 'Producción' : 'Preview'}  ${state} · ${affected}/${status.invitations} invitaciones · ${status.findings.length} referencias`,
		);
		if (!options.slug && !options.verbose) {
			const byRoute = new Map<string, number>();
			for (const finding of status.findings)
				byRoute.set(finding.route, (byRoute.get(finding.route) ?? 0) + 1);
			for (const [route, count] of [...byRoute].sort(([a], [b]) => a.localeCompare(b))) {
				lines.push(`    ${route} ${paint(33, `(${count})`)}`);
			}
			if (status.status === 'UNVERIFIED')
				lines.push(
					`    Reintentar: pnpm invitation:media:verify -- --target ${target} --all --json`,
				);
			continue;
		}
		lines.push(...formatMediaDetail(target, status));
	}
	if (
		!options.slug &&
		!options.verbose &&
		Boolean(media.preview?.findings.length || media.production?.findings.length)
	)
		lines.push(
			'  Detalle y comandos: pnpm dbs <slug> · Todas las referencias: pnpm dbs -- --verbose',
		);
	lines.push(paint(2, '  Comparación de URLs; entrega, MIME y SHA-256 no evaluados.'));
	return lines.join('\n') + '\n';
}
