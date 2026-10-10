import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitationRsvpPanel from '@/components/dashboard/intake/InvitationRsvpPanel';
import type { RsvpEventDTO } from '@/lib/dashboard/dto/intake';

const CSRF_TOKEN = 'csrf-test-token';

const RSVP_EVENT: RsvpEventDTO = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	slug: 'daniela-y-martin',
	eventType: 'boda',
	title: 'Boda de Daniela y Martín',
	status: 'published',
	guestCount: 10,
	confirmedCount: 4,
	declinedCount: 1,
	pendingCount: 5,
};

function setCsrfMeta(token: string) {
	document.querySelector('meta[name="csrf-token"]')?.remove();
	const meta = document.createElement('meta');
	meta.name = 'csrf-token';
	meta.content = token;
	document.head.appendChild(meta);
}

function mockFetchResponse(status: number, body: unknown) {
	const fetchMock = jest.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		statusText: '',
		headers: new Headers({ 'Content-Type': 'application/json' }),
		json: async () => body,
	});
	global.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

async function confirmDeactivation() {
	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Desactivar RSVP' }));
	const dialog = screen.getByRole('dialog');
	await user.click(within(dialog).getByRole('button', { name: 'Desactivar RSVP' }));
}

describe('InvitationRsvpPanel', () => {
	beforeEach(() => {
		setCsrfMeta(CSRF_TOKEN);
	});

	afterAll(() => {
		document.querySelector('meta[name="csrf-token"]')?.remove();
	});

	it('archives the RSVP event with the CSRF header and a status-only body', async () => {
		const confirmSpy = jest.spyOn(window, 'confirm');
		const fetchMock = mockFetchResponse(200, { item: { ...RSVP_EVENT, status: 'archived' } });
		const onDeactivated = jest.fn();
		render(<InvitationRsvpPanel rsvpEvent={RSVP_EVENT} onDeactivated={onDeactivated} />);

		await confirmDeactivation();

		await waitFor(() => expect(onDeactivated).toHaveBeenCalledTimes(1));
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`/api/dashboard/admin/events/${RSVP_EVENT.id}`);
		expect(init.method).toBe('PATCH');
		expect(init.headers).toMatchObject({ 'X-CSRF-Token': CSRF_TOKEN });
		expect(JSON.parse(init.body as string)).toEqual({ status: 'archived' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and keeps the panel when the request is rejected', async () => {
		mockFetchResponse(403, { error: { code: 'forbidden', message: 'CSRF inválido' } });
		const onDeactivated = jest.fn();
		render(<InvitationRsvpPanel rsvpEvent={RSVP_EVENT} onDeactivated={onDeactivated} />);

		await confirmDeactivation();

		expect(
			await screen.findByText('No se pudo desactivar el RSVP. Inténtelo de nuevo.'),
		).toBeInTheDocument();
		expect(onDeactivated).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('sends nothing when the confirmation is cancelled', async () => {
		const fetchMock = mockFetchResponse(200, {});
		const user = userEvent.setup();
		render(<InvitationRsvpPanel rsvpEvent={RSVP_EVENT} onDeactivated={jest.fn()} />);

		await user.click(screen.getByRole('button', { name: 'Desactivar RSVP' }));
		await user.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
		);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
