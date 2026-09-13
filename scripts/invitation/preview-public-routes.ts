#!/usr/bin/env tsx
/** Read-only published client route manifest for post-deploy browser coverage. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertPreviewDbUrl, getPreviewDbUrl, runPsql } from '../db/db-workflow-lib.ts';

export interface PublishedClientRoute {
	eventType: string;
	slug: string;
}

export function validatePublishedRoutes(value: unknown): PublishedClientRoute[] {
	if (!Array.isArray(value)) throw new Error('Published route inventory is not an array.');
	const seen = new Set<string>();
	return value.map((item) => {
		if (!item || typeof item !== 'object')
			throw new Error('Published route inventory is incomplete.');
		const row = item as Record<string, unknown>;
		if (
			typeof row.eventType !== 'string' ||
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.eventType) ||
			typeof row.slug !== 'string' ||
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.slug)
		)
			throw new Error(
				`Published route inventory has an invalid route: ${String(row.eventType)}/${String(row.slug)}.`,
			);
		const key = `${row.eventType}/${row.slug}`;
		if (seen.has(key)) throw new Error(`Duplicate published route: ${key}.`);
		seen.add(key);
		return { eventType: row.eventType, slug: row.slug };
	});
}

function main(): void {
	const output = process.argv[2];
	if (!output) throw new Error('Usage: preview-public-routes.ts <output.json>');
	const dbUrl = getPreviewDbUrl().url;
	assertPreviewDbUrl(dbUrl);
	const result = runPsql(
		`select coalesce(json_agg(row_to_json(t) order by t."eventType", t.slug), '[]'::json)::text
		from (select distinct i.event_type as "eventType", i.slug
		from public.invitations i join public.published_invitation_content p
			on p.invitation_project_id = i.id and p.deleted_at is null
		where i.kind = 'client' and i.archived_at is null) t;`,
		dbUrl,
		{
			tuplesOnly: true,
			throwOnError: true,
		},
	);
	const routes = validatePublishedRoutes(JSON.parse(result.stdout.trim()) as unknown);
	if (routes.length === 0) throw new Error('No published Preview client routes were found.');
	const path = resolve(output);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(routes, null, 2) + '\n');
	process.stdout.write(`Preview public route inventory: ${routes.length} client routes.\n`);
}

if (process.argv[1]?.endsWith('preview-public-routes.ts')) {
	try {
		main();
	} catch (error: unknown) {
		process.stderr.write(
			(error instanceof Error ? error.message : 'Route inventory failed') + '\n',
		);
		process.exitCode = 1;
	}
}
