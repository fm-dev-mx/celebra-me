import { expect, test } from '@playwright/test';
import { CANONICAL_HOST_ACCESS_TOKEN } from '../../scripts/playwright/canonical-host-fixture';
import { isVisualParityDeferred } from './harness/visual-baseline-policy';

const EVENT_ID = 'eaeb63e4-809b-427b-a52d-c61c2328c900';
const ROUTE = `/dashboard/invitados?eventId=${EVENT_ID}`;

async function resolveAuthToken(): Promise<string> {
	try {
		const { loadAppEnv, requireLocalSuperAdminConfig } =
			await import('../../scripts/db/db-workflow-lib.ts');
		const appEnv = loadAppEnv();
		const { email, password } = requireLocalSuperAdminConfig(appEnv);
		const res = await fetch(`${appEnv.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
			method: 'POST',
			headers: {
				apikey: appEnv.SUPABASE_ANON_KEY,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email, password }),
		});
		if (res.ok) {
			const data = (await res.json()) as { access_token?: string };
			if (data.access_token) return data.access_token;
		}
	} catch {
		// Canonical fixture or CI environment
	}
	return CANONICAL_HOST_ACCESS_TOKEN;
}

function makeMockGuest(options: {
	id: string;
	fullName: string;
	phone?: string;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	deliveryStatus?: 'generated' | 'shared';
}) {
	return {
		guestId: options.id,
		inviteId: `inv-${options.id}`,
		fullName: options.fullName,
		phone: options.phone ?? '',
		countryCode: '+52',
		email: null,
		tags: [],
		maxAllowedAttendees: 2,
		attendanceStatus: options.attendanceStatus ?? 'pending',
		attendeeCount: options.attendanceStatus === 'confirmed' ? 2 : 0,
		guestComment: '',
		deliveryStatus: options.deliveryStatus ?? 'generated',
		firstSharedAt: options.deliveryStatus === 'shared' ? '2026-10-20T00:00:00Z' : null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: options.attendanceStatus === 'confirmed' ? '2026-10-21T00:00:00Z' : null,
		waShareUrl: '',
		shareText: '',
		updatedAt: '2026-10-20T00:00:00Z',
	};
}

test.describe('Mobile guest dashboard walkthrough at 390px', () => {
	test.use({
		viewport: { width: 390, height: 844 },
	});

	test.skip(
		isVisualParityDeferred(),
		'Mobile guest dashboard walkthrough runs on develop pushes and nightly builds.',
	);

	test('walkthrough covers filtering, copying link, sending invitation and confirming attendance', async ({
		page,
		baseURL,
	}) => {
		const guest1 = makeMockGuest({
			id: 'guest-1',
			fullName: 'Sofía Martínez',
			phone: '6691112233',
			attendanceStatus: 'confirmed',
			deliveryStatus: 'shared',
		});
		const guest2 = makeMockGuest({
			id: 'guest-2',
			fullName: 'Carlos Gómez',
			phone: '6699876543',
			attendanceStatus: 'pending',
			deliveryStatus: 'generated',
		});

		const guests = [guest1, guest2];

		await page.route('**/api/dashboard/**', async (route) => {
			const url = new URL(route.request().url());
			const path = url.pathname;
			const method = route.request().method();

			if (path === '/api/dashboard/events') {
				return route.fulfill({
					json: {
						items: [
							{
								id: EVENT_ID,
								title: 'Mis XV años — Mía',
								slug: 'xv-mia',
								eventType: 'xv',
								status: 'published',
								brandingRemovalEnabled: false,
							},
						],
					},
				});
			}

			if (path === '/api/dashboard/guests' && method === 'GET') {
				const search = url.searchParams.get('search')?.toLowerCase() ?? '';
				const status = url.searchParams.get('status');

				let filtered = [...guests];
				if (search) {
					filtered = filtered.filter((g) => g.fullName.toLowerCase().includes(search));
				}
				if (status) {
					filtered = filtered.filter((g) => g.attendanceStatus === status);
				}

				return route.fulfill({
					json: {
						eventId: EVENT_ID,
						items: filtered,
						shareDateContext: {
							eventDate: '2026-11-20',
							daysUntilEvent: '26 días',
							rawDaysUntilEvent: 26,
							rsvpDeadline: '2026-11-10',
							eventTimingText: '',
							rsvpDeadlineText: '',
						},
						totals: {
							totalInvitations: guests.length,
							totalPeople: guests.length * 2,
							generatedInvitations: guests.filter(
								(g) => g.deliveryStatus === 'generated',
							).length,
							sharedInvitations: guests.filter((g) => g.deliveryStatus === 'shared')
								.length,
							pendingInvitations: guests.filter(
								(g) => g.attendanceStatus === 'pending',
							).length,
							pendingPeople:
								guests.filter((g) => g.attendanceStatus === 'pending').length * 2,
							confirmedInvitations: guests.filter(
								(g) => g.attendanceStatus === 'confirmed',
							).length,
							confirmedPeople:
								guests.filter((g) => g.attendanceStatus === 'confirmed').length * 2,
							declinedInvitations: 0,
							declinedPeople: 0,
							unconfirmedShared: 0,
							viewed: 0,
						},
						engagement: null,
					},
				});
			}

			if (path.startsWith('/api/dashboard/guests/') && method === 'PATCH') {
				const guestId = path.split('/').pop()!;
				const body = route.request().postDataJSON() as Record<string, unknown>;
				const target = guests.find((g) => g.guestId === guestId);
				if (target) {
					Object.assign(target, body);
					return route.fulfill({ json: { item: target } });
				}
				return route.fulfill({ status: 404, json: { message: 'Not found' } });
			}

			return route.fulfill({ status: 200, json: {} });
		});

		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const token = await resolveAuthToken();
		await page.context().addCookies([{ name: 'sb-access-token', value: token, url: baseURL }]);

		await page.goto(ROUTE, { waitUntil: 'networkidle' });
		await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });

		// 1. FILTRAR: Search for "Carlos"
		const searchInput = page.locator('input[type="search"]');
		await expect(searchInput).toBeVisible();
		await searchInput.fill('Carlos');
		await page.waitForTimeout(350);

		// Verify Carlos is shown and Sofía is filtered out
		await expect(page.locator('text=Carlos Gómez')).toBeVisible();
		await expect(page.locator('text=Sofía Martínez')).not.toBeVisible();

		// Clear search
		await searchInput.clear();
		await page.waitForTimeout(350);
		await expect(page.locator('text=Sofía Martínez')).toBeVisible();
		await expect(page.locator('text=Carlos Gómez')).toBeVisible();

		// Verify no horizontal overflow in initial list view at 390px
		const hasListOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		);
		expect(hasListOverflow).toBe(false);

		// 2. Switch to Tarjetas view and verify button layout styling
		const cardsToggle = page.locator('.guest-view-toggle__option:has-text("Tarjetas")');
		await expect(cardsToggle).toBeVisible();
		await cardsToggle.click();
		await page.waitForTimeout(300);

		// Verify no horizontal overflow in cards view at 390px
		const hasCardsOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		);
		expect(hasCardsOverflow).toBe(false);

		const copyBtn = page.locator('.guest-card__copy-btn').first();
		const detailsBtn = page.locator('.guest-card__details-btn').first();

		await expect(copyBtn).toBeVisible();
		await expect(detailsBtn).toBeVisible();

		// Layout check: Verify 48px height touch target alignment
		const copyBox = await copyBtn.boundingBox();
		const detailsBox = await detailsBtn.boundingBox();
		expect(copyBox).not.toBeNull();
		expect(detailsBox).not.toBeNull();
		expect(copyBox!.height).toBeGreaterThanOrEqual(47);
		expect(detailsBox!.height).toBeGreaterThanOrEqual(47);

		// 3. COPIAR ENLACE
		const copyButton = page.locator('.guest-card__copy-btn, .guest-row__copy').first();
		await copyButton.click();
		await expect(
			page.locator('.copy-link-button--copied, button:has-text("Enlace copiado")').first(),
		).toBeVisible();

		// 4. MANDAR INVITACIÓN: Open modal for Carlos
		const carlosCard = page.locator('.guest-card:has-text("Carlos Gómez")');
		const shareBtn = carlosCard.locator('.dashboard-guests__share-button');
		await expect(shareBtn).toBeVisible();
		await shareBtn.click();

		// Modal should open
		const sendModal = page.locator('.dashboard-modal--send-invitation');
		await expect(sendModal).toBeVisible();

		// Check close button 44px touch target
		const closeBtn = sendModal.locator('.btn-close');
		await expect(closeBtn).toBeVisible();
		const closeBox = await closeBtn.boundingBox();
		expect(closeBox).not.toBeNull();
		expect(closeBox!.width).toBeGreaterThanOrEqual(44);
		expect(closeBox!.height).toBeGreaterThanOrEqual(44);

		// Accessible mobile cancel button must be visible in footer and meet 44px touch target
		const cancelSendBtn = sendModal.locator('.dashboard-modal__footer-cancel');
		await expect(cancelSendBtn).toBeVisible();
		const cancelBox = await cancelSendBtn.boundingBox();
		expect(cancelBox).not.toBeNull();
		expect(cancelBox!.height).toBeGreaterThanOrEqual(44);
		await cancelSendBtn.focus();
		await expect(cancelSendBtn).toBeFocused();
		await cancelSendBtn.click();
		await expect(sendModal).not.toBeVisible();

		// 4b. PLANTILLAS DE MENSAJE: Open share templates modal and verify 44px cancel button
		const actionsTrigger = page.locator('.toolbar-actions-menu__trigger');
		await expect(actionsTrigger).toBeVisible();
		await actionsTrigger.click();

		const templatesMenuItem = page.locator(
			'.guest-actions-menu__item:has-text("Plantillas de mensaje")',
		);
		await expect(templatesMenuItem).toBeVisible();
		await templatesMenuItem.click();

		const shareTemplatesModal = page.locator('.dashboard-modal--share-templates');
		await expect(shareTemplatesModal).toBeVisible();

		// Check close button 44px touch target
		const closeShareBtn = shareTemplatesModal.locator('.btn-close');
		await expect(closeShareBtn).toBeVisible();
		const closeShareBox = await closeShareBtn.boundingBox();
		expect(closeShareBox).not.toBeNull();
		expect(closeShareBox!.width).toBeGreaterThanOrEqual(44);
		expect(closeShareBox!.height).toBeGreaterThanOrEqual(44);

		// Accessible mobile cancel button must be visible in footer and meet 44px touch target
		const cancelShareBtn = shareTemplatesModal.locator('.dashboard-modal__footer-cancel');
		await expect(cancelShareBtn).toBeVisible();
		const cancelShareBox = await cancelShareBtn.boundingBox();
		expect(cancelShareBox).not.toBeNull();
		expect(cancelShareBox!.height).toBeGreaterThanOrEqual(44);
		await cancelShareBtn.focus();
		await expect(cancelShareBtn).toBeFocused();
		await cancelShareBtn.click();
		await expect(shareTemplatesModal).not.toBeVisible();

		// 5. CONFIRMAR: Open details -> Edit -> Confirm attendance
		const carlosDetailsBtn = carlosCard.locator('.guest-card__details-btn');
		await carlosDetailsBtn.click();

		const detailSheet = page.locator('.guest-detail-sheet');
		await expect(detailSheet).toBeVisible();

		const editBtn = page.locator('.guest-detail-actions button:has-text("Editar")');
		await expect(editBtn).toBeVisible();
		await editBtn.click();

		const formModal = page.locator('.guest-form-modal');
		await expect(formModal).toBeVisible();

		// Expand response fields
		const responseToggle = page.locator('.guest-form__response-toggle');
		await responseToggle.click();

		// Select "confirmed"
		const attendanceSelect = page.locator('#attendanceStatus');
		await expect(attendanceSelect).toBeVisible();
		await attendanceSelect.selectOption('confirmed');

		// Save changes
		const saveBtn = formModal
			.locator('button:has-text("Guardar cambios"), button[type="submit"]')
			.first();
		await saveBtn.click();

		// Verify form modal closes
		await expect(formModal).not.toBeVisible({ timeout: 5000 });
	});
});
