/**
 * Republishes a definition over a row that still carries superseded Published shapes, through
 * `publish_invitation_atomic`, against the disposable DB (127.0.0.1:54332).
 * Executed only by `pnpm test:db:managed-contracts` (excluded from hermetic `pnpm test`).
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { DISPOSABLE_DB_URL } from '../../scripts/db/db-target-config.ts';
import { summarizeContentUsage } from '../../scripts/provision/content-usage-audit.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';
import { auditPublishedContent } from '../../src/lib/intake/services/published-content-audit.service.ts';

const harnessEnabled = process.env.CELEBRA_MANAGED_DB_CONTRACTS === '1';

const INVITATION_UUID = '13131313-0000-4000-8000-000000000001';
const DRAFT_UUID = '13131313-0000-4000-8000-000000000002';
const IDEMPOTENCY_UUID = '13131313-0000-4000-8000-000000000003';
const OWNER_UUID = 'a0000000-0000-0000-0000-000000000001';
const SLUG = 'aithan-darell';

function queryDb(sql: string): string {
	return runPsql(sql, DISPOSABLE_DB_URL, { tuplesOnly: true, throwOnError: true }).stdout.trim();
}

function execDb(sql: string): void {
	runPsql(sql, DISPOSABLE_DB_URL, { throwOnError: true });
}

function jsonLiteral(value: unknown): string {
	return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function readPublishedContent(): Record<string, unknown> {
	return JSON.parse(
		queryDb(
			`SELECT content FROM public.published_invitation_content WHERE invitation_project_id = '${INVITATION_UUID}' AND deleted_at IS NULL;`,
		),
	);
}

const definition = getInvitationDefinition(SLUG);
const republished = definition.buildPublishedContent(buildSemanticAssetMap(definition));
const legacy = (() => {
	const content = structuredClone(republished) as Record<string, any>;
	content.templateId = 'cumple-editorial-magazine';
	content.theme = { ...content.theme, fontFamily: 'serif' };
	content.location.venues[0].time = '5:30 p. m.';
	return content;
})();

describe('disposable republish without superseded Published shapes', () => {
	if (!harnessEnabled) {
		it.skip('requires CELEBRA_MANAGED_DB_CONTRACTS=1 (pnpm test:db:managed-contracts)', () => {});
		return;
	}

	beforeAll(() => {
		execDb(`
			DELETE FROM public.invitation_publication_idempotency WHERE invitation_id = '${INVITATION_UUID}';
			DELETE FROM public.invitation_content_drafts WHERE invitation_project_id = '${INVITATION_UUID}';
			DELETE FROM public.published_invitation_content WHERE invitation_project_id = '${INVITATION_UUID}' OR slug = '${SLUG}';
			DELETE FROM public.events WHERE slug = '${SLUG}' OR invitation_project_id = '${INVITATION_UUID}';
			DELETE FROM public.invitations WHERE id = '${INVITATION_UUID}' OR slug = '${SLUG}';
		`);
		execDb(`
			INSERT INTO public.invitations (id, slug, title, status, event_type, theme_id, kind, created_by)
			VALUES ('${INVITATION_UUID}', '${SLUG}', '${definition.title.replace(/'/g, "''")}',
				'published', '${definition.eventType}', 'editorial-magazine', 'client', '${OWNER_UUID}');
			INSERT INTO public.published_invitation_content
				(invitation_project_id, slug, event_type, is_demo, content, version, published_at)
			VALUES ('${INVITATION_UUID}', '${SLUG}', '${definition.eventType}', false, ${jsonLiteral(legacy)}, 1, now());
			INSERT INTO public.invitation_content_drafts (id, invitation_project_id, content, status)
			VALUES ('${DRAFT_UUID}', '${INVITATION_UUID}', ${jsonLiteral(republished)}, 'draft');
		`);
	});

	it('starts from a row that carries the superseded shapes', () => {
		const shapes = summarizeContentUsage(readPublishedContent()).supersededShapes;
		expect(Object.keys(shapes)).toEqual(
			expect.arrayContaining(['templateId', 'theme.fontFamily']),
		);
		expect(auditPublishedContent(readPublishedContent()).legacyDateTimeCount).toBeGreaterThan(
			0,
		);
	});

	it('republishes through publish_invitation_atomic and leaves no superseded shape', () => {
		const result = queryDb(`
			WITH inv AS (SELECT * FROM public.invitations WHERE id = '${INVITATION_UUID}'),
			pub AS (SELECT content FROM public.published_invitation_content
				WHERE invitation_project_id = '${INVITATION_UUID}' AND deleted_at IS NULL),
			draft AS (SELECT updated_at FROM public.invitation_content_drafts WHERE id = '${DRAFT_UUID}')
			SELECT public.publish_invitation_atomic(
				'${INVITATION_UUID}', '${DRAFT_UUID}', (SELECT updated_at FROM draft), 1,
				(SELECT md5(md5(jsonb_build_object(
					'archivedAt', inv.archived_at, 'eventType', inv.event_type, 'kind', inv.kind,
					'slug', inv.slug, 'status', inv.status, 'themeId', inv.theme_id, 'title', inv.title
				)::text) || chr(31) || md5((SELECT content FROM pub)::text)) FROM inv),
				'${'0'.repeat(64)}', '${IDEMPOTENCY_UUID}', '${SLUG}', '${definition.eventType}', false,
				${jsonLiteral(republished)}
			)->'publishedContent'->>'version';
		`);
		expect(result).toBe('2');

		const content = readPublishedContent();
		const shapes = Object.keys(summarizeContentUsage(content).supersededShapes);
		expect(
			shapes.filter((shape) => ['templateId', 'theme.fontFamily'].includes(shape)),
		).toEqual([]);
		expect(auditPublishedContent(content).legacyDateTimeCount).toBe(0);
		expect(content).toEqual(republished);
	});
});
