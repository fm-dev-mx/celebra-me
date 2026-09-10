import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowControls from '@/components/dashboard/intake/WorkflowControls';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { adminApi } from '@/lib/dashboard/admin-api';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: { setInvitationWorkflow: jest.fn() },
}));

const invitation = {
	id: 'invitation',
	updatedAt: '2026-09-10T12:00:00.000Z',
	archivedAt: null,
	workflow: { workStatus: 'completed', ownerReviewedAt: null, ownerReviewedBy: null },
} as InvitationDTO;

describe('workflow controls', () => {
	beforeEach(() => jest.resetAllMocks());
	it('shows completed work without claiming manual review', () => {
		render(
			<WorkflowControls
				invitation={invitation}
				canReviewManually={false}
				onUpdated={jest.fn()}
			/>,
		);
		expect(screen.getByText('Trabajo: Terminada')).toBeInTheDocument();
		expect(screen.getByText('Última revisión manual: Sin registrar')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Confirmar mi revisión manual' }),
		).not.toBeInTheDocument();
	});
	it('waits for persistence and refreshes after reopening work', async () => {
		jest.mocked(adminApi.setInvitationWorkflow).mockResolvedValue(undefined);
		const refresh = jest.fn().mockResolvedValue(undefined);
		render(
			<WorkflowControls
				invitation={invitation}
				canReviewManually={false}
				onUpdated={refresh}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: 'Marcar en proceso' }));
		await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
		expect(adminApi.setInvitationWorkflow).toHaveBeenCalledWith('invitation', {
			action: 'set_work_status',
			workStatus: 'in_progress',
			expectedUpdatedAt: invitation.updatedAt,
		});
	});
	it('renders the review action only for the authorized owner', () => {
		render(
			<WorkflowControls invitation={invitation} canReviewManually onUpdated={jest.fn()} />,
		);
		expect(
			screen.getByRole('button', { name: 'Confirmar mi revisión manual' }),
		).toBeInTheDocument();
	});
	it('keeps the displayed state when persistence fails', async () => {
		jest.mocked(adminApi.setInvitationWorkflow).mockRejectedValue(
			new Error('Recargue la lista.'),
		);
		const refresh = jest.fn();
		render(
			<WorkflowControls
				invitation={invitation}
				canReviewManually={false}
				onUpdated={refresh}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: 'Marcar en proceso' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Recargue la lista.');
		expect(refresh).not.toHaveBeenCalled();
		expect(screen.getByText('Trabajo: Terminada')).toBeInTheDocument();
	});
});
