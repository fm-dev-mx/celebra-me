jest.mock('@/hooks/use-invitation-admin', () => ({
	useInvitationAdmin: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import InvitationList from '@/components/dashboard/intake/InvitationList';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';

const mockUseInvitationAdmin = useInvitationAdmin as jest.MockedFunction<typeof useInvitationAdmin>;

it('shows a stable internal edit link instead of an unrecoverable capture-link state', () => {
	mockUseInvitationAdmin.mockReturnValue({
		items: [
			{
				id: 'proj-1',
				kind: 'client',
				sourceInvitationId: null,
				slug: null,
				title: 'Invitación interno',
				eventType: 'xv',
				status: 'draft',
				baseDemoId: 'demo-xv-jewelry-box',
				themeId: 'jewelry-box',
				clientName: '',
				clientEmail: '',
				clientWhatsapp: '',
				photosReceived: false,
				archivedAt: null,
				createdAt: '2026-05-30T00:00:00Z',
				updatedAt: '2026-05-30T00:00:00Z',
				hasRequest: true,
				hasSubmission: true,
				published: false,
				rsvpEventStatus: null,
				rsvpEventId: null,
				internalEditUrl: '/dashboard/invitaciones/proj-1/editar',
				captureUrl: null,
				captureLinkStatus: 'unavailable',
			},
		],
		loading: false,
		error: '',
		createInvitation: jest.fn(),
	} as never);

	render(<InvitationList />);

	expect(screen.getAllByRole('link', { name: 'Editar' })).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				href: 'http://localhost/dashboard/invitaciones/proj-1/editar',
			}),
		]),
	);
	expect(screen.queryByText('No recuperable')).not.toBeInTheDocument();
	expect(screen.getByRole('columnheader', { name: 'Invitación' })).toBeInTheDocument();
	expect(screen.getByRole('columnheader', { name: 'Actualizado' })).toBeInTheDocument();
	expect(screen.queryByRole('columnheader', { name: 'Enlace' })).not.toBeInTheDocument();
	expect(screen.queryByRole('columnheader', { name: 'RSVP' })).not.toBeInTheDocument();
});
