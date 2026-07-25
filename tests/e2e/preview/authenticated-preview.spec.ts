import { randomUUID } from 'node:crypto';
import { expect, previewEnvironment as preview, test } from './preview-test';
import {
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	assertPreviewPublicationTarget,
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
} from '../../../scripts/playwright/preview-environment';
import {
	attachSafePreviewDiagnostics,
	getJson,
	loginAsPreviewAdmin,
	mutateJson,
	readEditorContext,
	readPublicationPreflight,
	readSessionIdentity,
} from './support';

async function assertFixtureGuards(page: Parameters<typeof readSessionIdentity>[0]) {
	const session = await readSessionIdentity(page);
	assertExpectedPreviewAccountEmail(session.email);
	assertExpectedPreviewAccountRole(session.role);

	const context = await readEditorContext(page, preview.fixtureId);
	expect(context.invitation).toMatchObject({
		id: preview.fixtureId,
		kind: 'client',
		slug: PREVIEW_FIXTURE_SLUG,
		title: PREVIEW_FIXTURE_TITLE,
		eventType: PREVIEW_FIXTURE_EVENT_TYPE,
		baseDemoId: PREVIEW_FIXTURE_DEMO_ID,
		clientName: '',
		clientEmail: '',
		clientWhatsapp: '',
		createdBy: session.userId,
	});
	assertPreviewPublicationTarget({
		configuredFixtureId: preview.fixtureId,
		targetInvitationId: context.invitation.id,
		targetSlug: context.invitation.slug,
	});
	return { context, session };
}

test.describe.serial('Authenticated external Preview', () => {
	test('login, dashboard navigation, fixture preflight, and logout stay authorized', async ({
		page,
	}, testInfo) => {
		await loginAsPreviewAdmin(page, preview);
		await expect(page.getByRole('heading', { name: 'Invitados', exact: true })).toBeVisible();

		const { session, context } = await assertFixtureGuards(page);
		await expect(page.locator('.dashboard-sidebar__account')).toContainText(session.email);

		await page.goto('/dashboard/admin');
		await expect(page.getByRole('heading', { name: 'Administración global' })).toBeVisible();
		await expect(page.locator('.dashboard-env-banner--preview')).toBeVisible();

		await page.goto(`/dashboard/invitaciones/${encodeURIComponent(preview.fixtureId)}/editar`);
		await expect(page.getByRole('heading', { name: PREVIEW_FIXTURE_TITLE })).toBeVisible();

		const preflight = await readPublicationPreflight(page, preview.fixtureId);
		expect(Array.isArray(preflight.changedPaths)).toBe(true);
		expect(preflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);

		const diagnostics: Record<string, string | number | boolean> = {
			login: true,
			adminDashboard: true,
			editor: true,
			preflightChangedPathCount: preflight.changedPaths.length,
			hasPublishedContent: context.publication.hasPublishedContent,
		};
		if (context.publication.hasPublishedContent) {
			await expect(page.getByText('La versión pública está actualizada')).toBeVisible();
			expect(preflight.changedPaths).toEqual([]);
			const publicResponse = await page.request.get(
				`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_SLUG}`,
			);
			expect(publicResponse.status()).toBe(200);
			diagnostics.publicStatus = publicResponse.status();
		}
		await attachSafePreviewDiagnostics(testInfo, preview.debugArtifacts, diagnostics);

		await page.getByRole('button', { name: 'Cerrar sesión' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.locator('#login-submit')).toBeVisible();

		const sessionAfterLogout = await page.request.get('/api/auth/session');
		expect(sessionAfterLogout.status()).toBe(401);
		await page.goto('/dashboard/invitados');
		await expect(page).toHaveURL(/\/login/);
	});

	test.describe('Opt-in publication', () => {
		test.skip(
			!preview.allowPublication,
			'Publication requires PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION=true.',
		);

		test('no-change publication stays limited to the synthetic fixture', async ({
			page,
		}, testInfo) => {
			await loginAsPreviewAdmin(page, preview);
			const { context } = await assertFixtureGuards(page);
			expect(context.publication.hasPublishedContent).toBe(true);

			const before = await readPublicationPreflight(page, preview.fixtureId);
			expect(before.changedPaths).toEqual([]);

			const result = await mutateJson<{
				idempotent: boolean;
				publishedContent: { version: number };
			}>(
				page,
				`/api/dashboard/intake/${encodeURIComponent(preview.fixtureId)}/editor/publish`,
				'POST',
				{ ...before, idempotencyKey: randomUUID() },
				'Synthetic fixture publication',
			);
			expect(typeof result.idempotent).toBe('boolean');
			expect(result.publishedContent.version).toBeGreaterThan(before.publishedVersion ?? 0);

			const after = await readPublicationPreflight(page, preview.fixtureId);
			expect(after.changedPaths).toEqual([]);
			expect(after.projectionHash).toBe(before.projectionHash);

			const publicResponse = await page.request.get(
				`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_SLUG}`,
			);
			expect(publicResponse.status()).toBe(200);

			const editor = await getJson<{ publication: { hasUnpublishedChanges: boolean } }>(
				page,
				`/api/dashboard/intake/${encodeURIComponent(preview.fixtureId)}/editor`,
				'Post-publication editor check',
			);
			expect(editor.publication.hasUnpublishedChanges).toBe(false);
			await attachSafePreviewDiagnostics(testInfo, preview.debugArtifacts, {
				publicationOptIn: true,
				idempotent: result.idempotent,
				publishedVersion: result.publishedContent.version,
				postPublicationChangedPathCount: after.changedPaths.length,
				publicStatus: publicResponse.status(),
			});
		});
	});
});
