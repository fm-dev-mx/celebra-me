jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: { getInvitationAccess: jest.fn(), setInvitationAccess: jest.fn() },
}));

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import InvitationAccessPanel from '@/components/dashboard/intake/InvitationAccessPanel';
import { adminApi } from '@/lib/dashboard/admin-api';
import { ApiError } from '@/lib/rsvp/core/errors';

const getAccess = adminApi.getInvitationAccess as jest.Mock;
const setAccess = adminApi.setInvitationAccess as jest.Mock;

const paidVisible = {
	invitationId: 'inv-1',
	paymentStatus: 'paid' as const,
	publicAccess: 'enabled' as const,
	internalNote: null,
	version: 2,
	updatedAt: '2026-10-10T12:00:00Z',
	updatedBy: null,
};

describe('InvitationAccessPanel', () => {
	beforeEach(() => jest.clearAllMocks());

	it('explains what guests see for the current state', async () => {
		getAccess.mockResolvedValue({ ...paidVisible, paymentStatus: 'unpaid' });

		render(<InvitationAccessPanel invitationId="inv-1" archived={false} />);

		expect(await screen.findByText('Pago pendiente')).toBeInTheDocument();
		expect(screen.getByText('Visible')).toBeInTheDocument();
		expect(screen.getByText(/marca «Vista previa · Celebra-me»/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Marcar como pagada' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Deshabilitar invitación' })).toBeInTheDocument();
	});

	it('disables with the internal note after confirmation', async () => {
		getAccess.mockResolvedValue(paidVisible);
		setAccess.mockResolvedValue({
			...paidVisible,
			publicAccess: 'disabled',
			internalNote: 'Cliente pidió ocultarla',
			version: 3,
		});

		render(<InvitationAccessPanel invitationId="inv-1" archived={false} />);
		fireEvent.change(await screen.findByLabelText(/Nota interna/), {
			target: { value: '  Cliente pidió ocultarla  ' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Deshabilitar invitación' }));
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByText(/página neutral sin datos del evento/)).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole('button', { name: 'Deshabilitar' }));

		await waitFor(() =>
			expect(setAccess).toHaveBeenCalledWith('inv-1', {
				action: 'set_public_access',
				publicAccess: 'disabled',
				internalNote: 'Cliente pidió ocultarla',
				expectedVersion: 2,
			}),
		);
		expect(await screen.findByText('Invitación deshabilitada.')).toBeInTheDocument();
		expect(screen.getByText('Nota interna: Cliente pidió ocultarla')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Reactivar invitación' })).toBeInTheDocument();
	});

	it('reloads the state when another change won the race', async () => {
		getAccess.mockResolvedValueOnce(paidVisible).mockResolvedValueOnce({
			...paidVisible,
			paymentStatus: 'unpaid',
			version: 3,
		});
		setAccess.mockRejectedValue(
			new ApiError(409, 'conflict', 'El estado de la invitación cambió.'),
		);

		render(<InvitationAccessPanel invitationId="inv-1" archived={false} />);
		fireEvent.click(await screen.findByRole('button', { name: 'Marcar como no pagada' }));
		fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', {
				name: 'Marcar como no pagada',
			}),
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'El estado de la invitación cambió.',
		);
		await waitFor(() => expect(getAccess).toHaveBeenCalledTimes(2));
		expect(await screen.findByText('Pago pendiente')).toBeInTheDocument();
	});

	it('offers no changes while the invitation is archived', async () => {
		getAccess.mockResolvedValue(paidVisible);

		render(<InvitationAccessPanel invitationId="inv-1" archived />);

		expect(
			await screen.findByText('Restaure la invitación para cambiar su estado.'),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Marcar como no pagada' }),
		).not.toBeInTheDocument();
	});
});
