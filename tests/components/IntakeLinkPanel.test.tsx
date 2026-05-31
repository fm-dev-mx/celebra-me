import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntakeLinkPanel from '@/components/dashboard/intake/IntakeLinkPanel';

const activeRequest = {
	id: 'req-1',
	invitationId: 'proj-1',
	status: 'active' as const,
	origin: 'client' as const,
	enabledBlocks: ['event-details' as const],
	expiresAt: '2026-06-30T00:00:00Z',
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
	captureUrl: 'https://example.com/captura/token',
	captureLinkStatus: 'active' as const,
};

describe('IntakeLinkPanel', () => {
	it('renders copy and open actions for a recoverable active link without regenerating', async () => {
		const onRegenerate = jest.fn();
		Object.assign(navigator, {
			clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
		});
		render(<IntakeLinkPanel request={activeRequest} onRegenerate={onRegenerate} />);

		await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(activeRequest.captureUrl);
		expect(screen.getByRole('link', { name: 'Abrir enlace' })).toHaveAttribute(
			'href',
			activeRequest.captureUrl,
		);
		expect(onRegenerate).not.toHaveBeenCalled();
	});

	it('explains when a legacy link cannot be recovered', () => {
		render(
			<IntakeLinkPanel
				request={{ ...activeRequest, captureUrl: null, captureLinkStatus: 'unavailable' }}
				onRegenerate={jest.fn()}
			/>,
		);

		expect(
			screen.getByText(
				'Enlace no recuperable. Regenera el token solo si deseas invalidar el enlace anterior.',
			),
		).toBeInTheDocument();
	});

	it('allows an active client link to be revoked explicitly', async () => {
		const onRevoke = jest.fn();
		render(
			<IntakeLinkPanel
				request={activeRequest}
				onRegenerate={jest.fn()}
				onRevoke={onRevoke}
			/>,
		);

		await userEvent.click(screen.getByRole('button', { name: 'Revocar link cliente' }));

		expect(onRevoke).toHaveBeenCalledTimes(1);
	});
});
