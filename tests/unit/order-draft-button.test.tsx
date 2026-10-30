jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn() },
}));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import OrderDraftButton from '@/components/dashboard/commercial/OrderDraftButton';
beforeEach(() => jest.resetAllMocks());
it('requires explicit selection and shows a retryable API error', async () => {
	jest.mocked(dashboardApi.get).mockResolvedValue({
		ok: true,
		data: { data: { invitationId: null, editorUrl: null, presets: ['editorial'] } },
	} as never);
	jest.mocked(dashboardApi.post).mockResolvedValue({
		ok: false,
		message: 'Datos cambiaron. Actualice.',
	} as never);
	render(<OrderDraftButton orderId="order-1" />);
	const button = await screen.findByRole('button', { name: 'Crear borrador' });
	expect(button).toBeDisabled();
	fireEvent.change(screen.getByLabelText('Diseño de la invitación'), {
		target: { value: 'editorial' },
	});
	fireEvent.click(button);
	expect(await screen.findByRole('alert')).toHaveTextContent('Datos cambiaron. Actualice.');
	await waitFor(() => expect(button).toBeEnabled());
	expect(dashboardApi.post).toHaveBeenCalledWith(
		'/api/dashboard/commercial/orders/order-1/draft',
		{ themeId: 'editorial' },
	);
});
it('opens the existing draft without offering to recreate it', async () => {
	jest.mocked(dashboardApi.get).mockResolvedValue({
		ok: true,
		data: {
			data: {
				invitationId: 'id',
				editorUrl: '/dashboard/invitaciones/id/editar',
				presets: [],
			},
		},
	} as never);
	render(<OrderDraftButton orderId="order-1" />);
	expect(await screen.findByRole('link', { name: 'Abrir borrador' })).toHaveAttribute(
		'href',
		'/dashboard/invitaciones/id/editar',
	);
	expect(screen.queryByRole('button', { name: 'Crear borrador' })).not.toBeInTheDocument();
});
