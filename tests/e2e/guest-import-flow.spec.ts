import { expect, test, type Page } from '@playwright/test';
import { CANONICAL_HOST_ACCESS_TOKEN } from '../../scripts/playwright/canonical-host-fixture';
import { isVisualParityDeferred } from './harness/visual-baseline-policy';

// A host imports a pasted list of guests from the dashboard. The canonical fixture transport admits
// a synthetic host session; every dashboard API is mocked in the browser, so nothing is written.
const EVENT_ID = 'eeeeeeee-0000-4000-8000-000000000101';
const ROUTE = `/dashboard/invitados?eventId=${EVENT_ID}`;

const PASTED_LIST = [
	'nombre,telefono,clave_pais',
	'Ana López,6691234567,+52',
	'Luis Pérez,6699876543,+52',
	'María Ruiz,6691112233,+52',
].join('\n');

type ImportedGuest = { full_name: string; phone: string | null; country_code: string | null };

function guestItem(guest: ImportedGuest, index: number) {
	return {
		guestId: `00000000-0000-4000-8000-00000000010${index}`,
		inviteId: `00000000-0000-4000-8000-00000000020${index}`,
		fullName: guest.full_name,
		phone: guest.phone ?? '',
		countryCode: guest.country_code ?? '+52',
		email: null,
		tags: [],
		maxAllowedAttendees: 1,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		firstSharedAt: null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: null,
		waShareUrl: '',
		shareText: '',
		updatedAt: '2026-10-20T00:00:00Z',
	};
}

function guestList(items: ReturnType<typeof guestItem>[]) {
	return {
		eventId: EVENT_ID,
		items,
		shareDateContext: {
			eventDate: '',
			daysUntilEvent: '',
			rawDaysUntilEvent: null,
			rsvpDeadline: '',
			eventTimingText: '',
			rsvpDeadlineText: '',
		},
		totals: {
			totalInvitations: items.length,
			totalPeople: items.length,
			generatedInvitations: items.length,
			sharedInvitations: 0,
			pendingInvitations: items.length,
			pendingPeople: items.length,
			confirmedInvitations: 0,
			confirmedPeople: 0,
			declinedInvitations: 0,
			declinedPeople: 0,
			unconfirmedShared: 0,
			viewed: 0,
		},
		engagement: null,
		updatedAt: '2026-10-20T00:00:00Z',
	};
}

async function mockDashboard(page: Page) {
	const imports: Array<{ eventId: string; guests: ImportedGuest[] }> = [];
	let stored: ReturnType<typeof guestItem>[] = [];
	const unexpected: string[] = [];

	// Registered first so the specific routes below win; any other dashboard call fails the test.
	await page.route('**/api/dashboard/**', async (route) => {
		unexpected.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
		await route.fulfill({ status: 500, json: { message: 'Unmocked dashboard request.' } });
	});
	await page.route('**/api/dashboard/events*', (route) =>
		route.fulfill({
			json: {
				items: [
					{
						id: EVENT_ID,
						title: 'XV de prueba',
						slug: 'xv-de-prueba',
						eventType: 'xv',
						status: 'published',
						brandingRemovalEnabled: false,
					},
				],
			},
		}),
	);
	await page.route('**/api/dashboard/guests?*', (route) =>
		route.fulfill({ json: guestList(stored) }),
	);
	await page.route('**/api/dashboard/guests/bulk', async (route) => {
		const body = route.request().postDataJSON() as { eventId: string; guests: ImportedGuest[] };
		imports.push(body);
		stored = body.guests.map(guestItem);
		await route.fulfill({
			json: {
				data: {
					created: body.guests.length,
					updated: 0,
					skipped: 0,
					conflicts: 0,
					status: 'success',
					errors: [],
				},
				message: 'Importación completada correctamente.',
			},
		});
	});
	return { imports, unexpected };
}

test.describe('Guest import flow', () => {
	// Runs with complete visual parity: develop pushes, release promotions and nightly on develop.
	test.skip(
		isVisualParityDeferred(),
		'Guest import runs on develop pushes, release promotions and nightly on develop.',
	);

	test('a host pastes a guest list, reviews it and imports every new guest', async ({
		page,
		baseURL,
	}) => {
		await page
			.context()
			.addCookies([
				{ name: 'sb-access-token', value: CANONICAL_HOST_ACCESS_TOKEN, url: baseURL },
			]);
		const { imports, unexpected } = await mockDashboard(page);

		await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(new RegExp(`/dashboard/invitados\\?eventId=${EVENT_ID}`));

		await page.getByRole('button', { name: 'Más acciones', exact: true }).click();
		await page.getByRole('menuitem', { name: 'Importar' }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'Importación de invitados' });
		await expect(dialog).toBeVisible();

		await dialog.getByPlaceholder(/Ejemplo: Juan/).fill(PASTED_LIST);
		for (const name of ['Ana López', 'Luis Pérez', 'María Ruiz']) {
			await expect(dialog.getByRole('cell', { name })).toBeVisible();
		}
		await dialog.getByRole('button', { name: 'Importar 3 cambios' }).click();

		// The preview dialog gives way to a separate result dialog.
		const result = page.getByRole('dialog').filter({ hasText: 'Resultado de la importación' });
		await expect(result).toContainText(/3\s*invitados creados/);
		expect(imports).toHaveLength(1);
		expect(imports[0]?.eventId).toBe(EVENT_ID);
		expect(imports[0]?.guests).toEqual([
			expect.objectContaining({
				full_name: 'Ana López',
				phone: '6691234567',
				country_code: '+52',
			}),
			expect.objectContaining({
				full_name: 'Luis Pérez',
				phone: '6699876543',
				country_code: '+52',
			}),
			expect.objectContaining({
				full_name: 'María Ruiz',
				phone: '6691112233',
				country_code: '+52',
			}),
		]);

		await result.getByRole('button', { name: 'Cerrar' }).click();
		await expect(result).toBeHidden();
		await expect(
			page.getByRole('button', { name: 'Más acciones de María Ruiz' }),
		).toBeVisible();
		expect(unexpected).toEqual([]);
	});
});
