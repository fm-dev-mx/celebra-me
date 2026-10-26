import { expect, test, type Page } from '@playwright/test';

/**
 * «Datos de su invitación»: the private form opens prefilled from the lead, autosaves while the
 * client types, blocks sending without the required fields, and sends from the review step. The
 * form API is mocked, so nothing touches a database.
 */

const TOKEN = 'e2eInvitationDataToken_0123456789abcdefghij';
const FORM_PATH = `/mi-invitacion/${TOKEN}`;

interface MockState {
	status: 'sent' | 'in_progress' | 'submitted';
	answers: Record<string, string>;
}

async function mockFormApi(page: Page, initial: MockState) {
	const state: MockState = { ...initial, answers: { ...initial.answers } };
	const calls: { token: string; action: string; answers?: Record<string, string> }[] = [];
	await page.route('**/api/mi-invitacion', async (route) => {
		const body = route.request().postDataJSON() as (typeof calls)[number];
		calls.push(body);
		if (body.action !== 'load') {
			state.answers = { ...(body.answers ?? {}) };
			state.status =
				body.action === 'submit'
					? 'submitted'
					: state.status === 'submitted'
						? 'submitted'
						: 'in_progress';
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					status: state.status,
					eventType: 'xv',
					answers: state.answers,
					expiresAt: '2026-12-25T00:00:00.000Z',
					lastSavedAt: body.action === 'load' ? null : new Date().toISOString(),
					submittedAt: state.status === 'submitted' ? new Date().toISOString() : null,
				},
			}),
		});
	});
	return calls;
}

test.describe('invitation data form', () => {
	test('opens prefilled, autosaves, and sends from the review step', async ({ page }) => {
		const calls = await mockFormApi(page, {
			status: 'sent',
			answers: { celebrantNames: 'Andrea' },
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(FORM_PATH);
		await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });

		await expect(page.getByRole('heading', { level: 1, name: 'Su celebración' })).toBeVisible();
		await expect(page.getByLabel(/Nombre\(s\) de quien celebra/)).toHaveValue('Andrea');
		expect(calls[0]).toEqual({ token: TOKEN, action: 'load' });

		await page.getByLabel('Fecha del evento').fill('2026-12-12');
		await expect
			.poll(() => calls.filter((call) => call.action === 'save').length, { timeout: 5_000 })
			.toBeGreaterThan(0);
		expect(calls.at(-1)?.answers).toMatchObject({
			celebrantNames: 'Andrea',
			eventDate: '2026-12-12',
		});

		for (let index = 0; index < 7; index += 1) {
			await page
				.getByRole('button', { name: /^(Siguiente|Revisar)$/ })
				.click({ force: true });
		}
		await page.getByRole('button', { name: 'Enviar mis datos' }).click({ force: true });

		await expect(page.getByRole('heading', { name: '¡Recibimos sus datos!' })).toBeVisible();
		expect(calls.at(-1)).toMatchObject({
			action: 'submit',
			answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
		});
	});

	test('keeps the form open and marks the missing fields when sending too early', async ({
		page,
	}) => {
		const calls = await mockFormApi(page, { status: 'sent', answers: {} });
		await page.goto(FORM_PATH);
		await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
		await expect(page.getByRole('heading', { level: 1, name: 'Su celebración' })).toBeVisible();

		for (let index = 0; index < 7; index += 1) {
			await page
				.getByRole('button', { name: /^(Siguiente|Revisar)$/ })
				.click({ force: true });
		}
		await page.getByRole('button', { name: 'Enviar mis datos' }).click({ force: true });

		await expect(page.getByRole('alert')).toContainText('Faltan datos necesarios');
		expect(calls.some((call) => call.action === 'submit')).toBe(false);
	});

	test('allows uploading and removing photos in the fotos step', async ({ page }) => {
		await mockFormApi(page, {
			status: 'in_progress',
			answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
		});

		const uploadedPhoto = {
			id: 'photo-uuid-1',
			url: 'https://cdn.celebra-me.com/foto-test.jpg',
			name: 'foto-test.jpg',
			size: 153600,
			type: 'image/jpeg',
			uploadedAt: '2026-10-26T18:00:00.000Z',
		};

		await page.route('**/api/mi-invitacion/photos', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						data: {
							photo: uploadedPhoto,
							answers: {
								celebrantNames: 'Andrea',
								eventDate: '2026-12-12',
								photos: [uploadedPhoto],
							},
						},
					}),
				});
				return;
			}
			if (route.request().method() === 'DELETE') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						data: {
							success: true,
							answers: {
								celebrantNames: 'Andrea',
								eventDate: '2026-12-12',
								photos: [],
							},
						},
					}),
				});
				return;
			}
			await route.continue();
		});

		await page.goto(FORM_PATH);
		await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });

		// Advance to Fotos step (step 5)
		for (let i = 0; i < 5; i += 1) {
			await page.getByRole('button', { name: 'Siguiente' }).click({ force: true });
		}
		await expect(
			page.getByRole('heading', { level: 1, name: 'Fotos para su invitación' }),
		).toBeVisible();

		// Upload photo via input file
		const fileInput = page.locator('#invitation-data-photos-input');
		await fileInput.setInputFiles({
			name: 'foto-test.jpg',
			mimeType: 'image/jpeg',
			buffer: Buffer.from('fake image content'),
		});

		// Verify photo is displayed
		await expect(page.getByText('foto-test.jpg')).toBeVisible();
		await expect(page.getByAltText('foto-test.jpg')).toHaveAttribute(
			'src',
			'https://cdn.celebra-me.com/foto-test.jpg',
		);

		// Delete photo
		await page.getByRole('button', { name: 'Eliminar foto foto-test.jpg' }).click();
		await expect(page.getByText('foto-test.jpg')).not.toBeVisible();
	});

	test('explains an expired link instead of showing the form', async ({ page }) => {
		await page.route('**/api/mi-invitacion', (route) =>
			route.fulfill({
				status: 410,
				contentType: 'application/json',
				body: JSON.stringify({
					error: {
						code: 'invitation_unavailable',
						message: 'Este enlace ya venció. Pídanos uno nuevo por WhatsApp.',
					},
				}),
			}),
		);
		await page.goto(FORM_PATH);

		await expect(
			page.getByRole('heading', { name: 'No pudimos abrir su formulario' }),
		).toBeVisible();
		await expect(page.getByRole('alert')).toContainText('venció');
	});

	test('stops autosaving and explains why once the link was replaced', async ({ page }) => {
		const actions: string[] = [];
		await page.route('**/api/mi-invitacion', async (route) => {
			const { action } = route.request().postDataJSON() as { action: string };
			actions.push(action);
			if (action === 'load') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						data: {
							status: 'in_progress',
							eventType: 'xv',
							answers: {},
							expiresAt: '2026-12-25T00:00:00.000Z',
							lastSavedAt: null,
							submittedAt: null,
						},
					}),
				});
				return;
			}
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({
					error: { code: 'not_found', message: 'Este enlace ya no es válido.' },
				}),
			});
		});
		await page.goto(FORM_PATH);

		await page.getByLabel(/Nombre\(s\) de quien celebra/).fill('Andrea');
		await expect(page.getByText('Este enlace ya no es válido.')).toBeVisible();
		// Past the retry delay: no further save goes out.
		await page.waitForTimeout(6_000);
		expect(actions.filter((action) => action === 'save')).toHaveLength(1);
	});
});
