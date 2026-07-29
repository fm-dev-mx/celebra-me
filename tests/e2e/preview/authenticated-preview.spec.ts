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
		targetOwnerEmail: session.email,
		targetEnvironment: preview.runtime.targetEnvironment,
	});
	return { context, session };
}

test.describe.serial('Authenticated external Preview', () => {
	test('login, dashboard navigation, fixture preflight, and logout stay authorized', async ({
		page,
	}) => {
		await loginAsPreviewAdmin(page, preview);
		await expect(page.getByRole('heading', { name: 'Invitados', exact: true })).toBeVisible();

		const { session, context } = await assertFixtureGuards(page);
		await expect(page.locator('.dashboard-sidebar__account')).toContainText(session.email);

		await page.goto('/dashboard/admin');
		await expect(page.getByRole('heading', { name: 'Administración global' })).toBeVisible();
		await expect(page.locator('.dashboard-env-banner--preview')).toBeVisible();

		await page.goto(`/dashboard/invitaciones/${encodeURIComponent(preview.fixtureId)}/editar`);
		await expect(page.getByRole('heading', { name: PREVIEW_FIXTURE_TITLE })).toBeVisible();

		if (context.draftStatus === 'draft') {
			const preflight = await readPublicationPreflight(page, preview.fixtureId);
			expect(Array.isArray(preflight.changedPaths)).toBe(true);
			expect(preflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);
			if (context.publication.hasPublishedContent) {
				expect(preflight.changedPaths).toEqual([]);
			}
		} else {
			expect(context.draftStatus).toBe('approved');
			expect(context.publication.hasPublishedContent).toBe(true);
			expect(context.publication.hasUnpublishedChanges).toBe(false);
		}

		if (context.publication.hasPublishedContent) {
			await expect(page.getByText('La versión pública está actualizada')).toBeVisible();
			const publicResponse = await page.request.get(
				`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_SLUG}`,
			);
			expect(publicResponse.status()).toBe(200);
		}

		const logoutButton = page.getByRole('button', { name: 'Cerrar sesión' });
		await logoutButton.focus();
		await page.keyboard.press('Enter');
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

		test('publication stays limited to the synthetic fixture', async ({ page }) => {
			await loginAsPreviewAdmin(page, preview);
			const { context } = await assertFixtureGuards(page);

			const before = await readPublicationPreflight(page, preview.fixtureId);
			if (context.publication.hasPublishedContent) {
				expect(before.changedPaths).toEqual([]);
			} else {
				expect(before.changedPaths.length).toBeGreaterThan(0);
			}
			const idempotencyKey = randomUUID();
			const publicationInput = { ...before, idempotencyKey };

			const result = await mutateJson<{
				idempotent: boolean;
				publishedContent: { version: number };
			}>(
				page,
				`/api/dashboard/intake/${encodeURIComponent(preview.fixtureId)}/editor/publish`,
				'POST',
				publicationInput,
				'Synthetic fixture publication',
			);
			expect(typeof result.idempotent).toBe('boolean');
			expect(result.publishedContent.version).toBeGreaterThan(before.publishedVersion ?? 0);

			const replay = await mutateJson<{
				idempotent: boolean;
				publishedContent: { version: number };
			}>(
				page,
				`/api/dashboard/intake/${encodeURIComponent(preview.fixtureId)}/editor/publish`,
				'POST',
				publicationInput,
				'Synthetic fixture publication replay',
			);
			expect(replay.idempotent).toBe(result.idempotent);
			expect(replay.publishedContent.version).toBe(result.publishedContent.version);

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
		});
	});
});
