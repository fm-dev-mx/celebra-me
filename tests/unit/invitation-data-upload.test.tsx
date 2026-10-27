import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvitationDataForm from '@/components/invitation-data/InvitationDataForm';

it('keeps a successful upload visible and in subsequent saves when the next file fails', async () => {
	const photo = {
		id: '11111111-1111-4111-8111-111111111111',
		url: 'https://example.invalid/photo.jpg',
		name: 'primera.jpg',
		size: 10,
		type: 'image/jpeg',
	};
	const state = {
		status: 'in_progress',
		answers: {},
		eventType: 'xv',
		expiresAt: '2026-12-25T00:00:00Z',
		lastSavedAt: null,
		submittedAt: null,
	};
	let uploads = 0;
	let saved: Record<string, unknown> | undefined;
	const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
		if (url === '/api/mi-invitacion/photos') {
			uploads += 1;
			return {
				ok: uploads === 1,
				json: async () =>
					uploads === 1
						? { data: { photo, answers: { photos: [photo] } } }
						: { error: { message: 'No se pudo subir la segunda foto.' } },
			} as Response;
		}
		const body = JSON.parse(String(options?.body)) as {
			action: string;
			answers?: Record<string, unknown>;
		};
		if (body.action === 'save') saved = body.answers;
		return {
			ok: true,
			json: async () => ({ data: { ...state, answers: body.answers ?? {} } }),
		} as Response;
	});
	try {
		render(<InvitationDataForm token={'A'.repeat(43)} />);
		await screen.findByRole('heading', { name: 'Su celebración' });
		for (let index = 0; index < 5; index += 1)
			fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
		fireEvent.change(document.querySelector('#invitation-data-photos-input')!, {
			target: {
				files: [
					new File(['one'], 'primera.jpg', { type: 'image/jpeg' }),
					new File(['two'], 'segunda.jpg', { type: 'image/jpeg' }),
				],
			},
		});
		await screen.findByText('No se pudo subir la segunda foto.');
		expect(screen.getByAltText('primera.jpg')).toBeInTheDocument();
		for (let index = 0; index < 5; index += 1)
			fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
		fireEvent.change(screen.getByLabelText(/Nombre\(s\) de quien celebra/), {
			target: { value: 'Synthetic name' },
		});
		await waitFor(() => expect(saved?.photos).toEqual([photo]), { timeout: 2500 });
	} finally {
		fetchSpy.mockRestore();
	}
});
