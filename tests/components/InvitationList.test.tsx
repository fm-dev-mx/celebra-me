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
				slug: null,
				title: 'Proyecto interno',
				eventType: 'xv',
				status: 'draft',
				baseDemoId: 'demo-xv-jewelry-box',
				themeId: 'jewelry-box',
				clientName: '',
				clientEmail: '',
				clientWhatsapp: '',
				photosReceived: false,
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
		createProject: jest.fn(),
	} as never);

	render(<InvitationList />);

	expect(screen.getAllByRole('link', { name: 'Editar datos' })).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				href: 'http://localhost/dashboard/invitaciones/proj-1/editar',
			}),
		]),
	);
	expect(screen.queryByText('No recuperable')).not.toBeInTheDocument();
});
