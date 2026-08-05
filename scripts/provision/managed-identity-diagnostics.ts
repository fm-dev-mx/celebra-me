/**
 * managed-identity-diagnostics.ts — Alias-aware managed identity integrity checks.
 *
 * Detects historical slug collisions, conflicting managed identities, and archived
 * parents with active children. Includes in_progress definitions from the registry.
 * Probe failures fail closed as unverified errors (never silent pass).
 */

import { listInvitationDefinitions } from './invitations/registry.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';

export type ManagedIdentityFindingCode =
	| 'HISTORICAL_SLUG_ACTIVE'
	| 'MANAGED_IDENTITY_CONFLICT'
	| 'ARCHIVED_PARENT_ACTIVE_CHILD'
	| 'MISSING_MANAGED_IDENTITY'
	| 'DIAGNOSTIC_PROBE_FAILED';

export interface ManagedIdentityFinding {
	code: ManagedIdentityFindingCode;
	severity: 'error' | 'warning';
	slug: string;
	managedIdentityId?: string | null;
	invitationId?: string | null;
	detail: string;
}

export interface ManagedIdentityDiagnosticsReport {
	ok: boolean;
	findings: ManagedIdentityFinding[];
	definitionAliasCount: number;
	probeErrors: number;
}

function parseJsonArray(raw: string): Array<Record<string, unknown>> | null {
	const text = raw.trim();
	if (!text || text === 'null') return [];
	try {
		const parsed = JSON.parse(text) as unknown;
		return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null;
	} catch {
		return null;
	}
}

function probeJsonArray(
	dbUrl: string,
	sql: string,
	label: string,
	findings: ManagedIdentityFinding[],
): Array<Record<string, unknown>> {
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (result.status !== 0) {
		findings.push({
			code: 'DIAGNOSTIC_PROBE_FAILED',
			severity: 'error',
			slug: '',
			detail: `${label} failed: ${(result.stderr || result.stdout || 'unknown error').trim().slice(0, 300)}`,
		});
		return [];
	}
	const parsed = parseJsonArray(result.stdout);
	if (parsed === null) {
		findings.push({
			code: 'DIAGNOSTIC_PROBE_FAILED',
			severity: 'error',
			slug: '',
			detail: `${label} returned unparseable JSON.`,
		});
		return [];
	}
	return parsed;
}

export function collectDefinitionAliasMap(): Array<{
	slug: string;
	managedIdentityId: string;
	previousSlugs: string[];
	lifecycle: string;
}> {
	return listInvitationDefinitions().map((definition) => ({
		slug: definition.slug,
		managedIdentityId: definition.managedIdentityId,
		previousSlugs: [...(definition.previousSlugs ?? [])],
		lifecycle: definition.lifecycle,
	}));
}

export function runManagedIdentityDiagnostics(dbUrl: string): ManagedIdentityDiagnosticsReport {
	const definitions = collectDefinitionAliasMap();
	const findings: ManagedIdentityFinding[] = [];

	for (const definition of definitions) {
		for (const previousSlug of definition.previousSlugs) {
			const result = runPsql(
				`select row_to_json(t) from (
          select i.id::text, i.slug, i.managed_identity_id::text, i.status
          from public.invitations i
          where i.slug = ${sqlLiteral(previousSlug)}
            and i.archived_at is null
          limit 1
        ) t;`,
				dbUrl,
				{ tuplesOnly: true, throwOnError: false },
			);
			if (result.status !== 0) {
				findings.push({
					code: 'DIAGNOSTIC_PROBE_FAILED',
					severity: 'error',
					slug: definition.slug,
					managedIdentityId: definition.managedIdentityId,
					detail: `Historical slug probe for "${previousSlug}" failed.`,
				});
				continue;
			}
			const active = result.stdout.trim();
			if (!active) continue;
			try {
				const row = JSON.parse(active) as {
					id: string;
					slug: string;
					managed_identity_id: string | null;
				};
				findings.push({
					code: 'HISTORICAL_SLUG_ACTIVE',
					severity: 'error',
					slug: definition.slug,
					managedIdentityId: definition.managedIdentityId,
					invitationId: row.id,
					detail: `Historical slug "${previousSlug}" is still active (definition lifecycle=${definition.lifecycle}). Rekey or purge required.`,
				});
			} catch {
				findings.push({
					code: 'DIAGNOSTIC_PROBE_FAILED',
					severity: 'error',
					slug: definition.slug,
					managedIdentityId: definition.managedIdentityId,
					detail: `Historical slug probe for "${previousSlug}" returned invalid JSON.`,
				});
			}
		}
	}

	const conflictRows = probeJsonArray(
		dbUrl,
		`select coalesce(json_agg(t), '[]'::json) from (
        select managed_identity_id::text as managed_identity_id,
               count(*)::int as row_count,
               array_agg(id::text order by created_at) as invitation_ids,
               array_agg(slug order by created_at) as slugs
        from public.invitations
        where managed_identity_id is not null
          and archived_at is null
        group by managed_identity_id
        having count(*) > 1
      ) t;`,
		'Managed identity conflict probe',
		findings,
	);
	for (const row of conflictRows) {
		findings.push({
			code: 'MANAGED_IDENTITY_CONFLICT',
			severity: 'error',
			slug: Array.isArray(row.slugs) ? String(row.slugs[0] ?? '') : '',
			managedIdentityId: row.managed_identity_id ? String(row.managed_identity_id) : null,
			detail: `Managed identity has ${row.row_count} active invitation rows: ${JSON.stringify(row.invitation_ids)}.`,
		});
	}

	const archivedActiveChildren = probeJsonArray(
		dbUrl,
		`select coalesce(json_agg(t), '[]'::json) from (
        select i.id::text as invitation_id,
               i.slug,
               i.managed_identity_id::text as managed_identity_id,
               (select count(*)::int from public.events e where e.invitation_project_id = i.id and e.deleted_at is null) as active_events,
               (select count(*)::int from public.published_invitation_content p where p.invitation_project_id = i.id and p.deleted_at is null) as active_published,
               (select count(*)::int from public.invitation_content_drafts d where d.invitation_project_id = i.id and d.deleted_at is null) as active_drafts,
               (select count(*)::int from public.intake_requests r where r.invitation_project_id = i.id and r.deleted_at is null) as active_intake,
               (select count(*)::int from public.intake_submissions s
                 where s.deleted_at is null
                   and s.intake_request_id in (
                     select r.id from public.intake_requests r where r.invitation_project_id = i.id
                   )) as active_submissions
        from public.invitations i
        where i.archived_at is not null
          and (
            exists (select 1 from public.events e where e.invitation_project_id = i.id and e.deleted_at is null)
            or exists (select 1 from public.published_invitation_content p where p.invitation_project_id = i.id and p.deleted_at is null)
            or exists (select 1 from public.invitation_content_drafts d where d.invitation_project_id = i.id and d.deleted_at is null)
            or exists (select 1 from public.intake_requests r where r.invitation_project_id = i.id and r.deleted_at is null)
            or exists (
              select 1 from public.intake_submissions s
              where s.deleted_at is null
                and s.intake_request_id in (
                  select r.id from public.intake_requests r where r.invitation_project_id = i.id
                )
            )
          )
      ) t;`,
		'Archived-parent active-child probe',
		findings,
	);
	for (const row of archivedActiveChildren) {
		findings.push({
			code: 'ARCHIVED_PARENT_ACTIVE_CHILD',
			severity: 'error',
			slug: String(row.slug ?? ''),
			managedIdentityId: row.managed_identity_id ? String(row.managed_identity_id) : null,
			invitationId: row.invitation_id ? String(row.invitation_id) : null,
			detail: `Archived invitation has active children (events=${row.active_events}, published=${row.active_published}, drafts=${row.active_drafts}, intake=${row.active_intake}, submissions=${row.active_submissions}).`,
		});
	}

	const probeErrors = findings.filter((finding) => finding.code === 'DIAGNOSTIC_PROBE_FAILED').length;
	return {
		ok: findings.every((finding) => finding.severity !== 'error'),
		findings,
		definitionAliasCount: definitions.reduce(
			(sum, definition) => sum + definition.previousSlugs.length,
			0,
		),
		probeErrors,
	};
}
