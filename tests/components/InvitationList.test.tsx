jest.mock('@/hooks/use-invitation-admin', () => ({
	useInvitationAdmin: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvitationList from '@/components/dashboard/intake/InvitationList';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';

const mockUseInvitationAdmin = useInvitationAdmin as jest.Mock;

function makeMockAdmin(overrides: Record<string, unknown> = {}) {
	return {
		items: [] as InvitationDTO[],
		loading: false,
		error: '',
		createInvitation: jest.fn(),
		archiveInvitation: jest.fn(),
		restoreInvitation: jest.fn(),
		permanentlyDeleteInvitation: jest.fn(),
		duplicateInvitationFromDemo: jest.fn(),
		...overrides,
	};
}

function makeItem(overrides: Record<string, unknown> = {}): InvitationDTO {
	return {
		id: 'proj-1',
		kind: 'client',
		sourceInvitationId: null,
		slug: null,
		title: 'Invitación test',
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
		hasRequest: false,
		hasSubmission: false,
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		internalEditUrl: '/dashboard/invitaciones/proj-1/editar',
		captureUrl: null,
		captureLinkStatus: null,
		...overrides,
	} as InvitationDTO;
}

describe('InvitationList', () => {
	it('shows a stable internal edit link', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({
						id: 'proj-1',
						title: 'Invitación interno',
						status: 'draft',
						updatedAt: '2026-05-30T00:00:00Z',
					}),
				],
			}),
		);

		render(<InvitationList />);

		expect(screen.getAllByRole('link', { name: 'Editar' })).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					href: 'http://localhost/dashboard/invitaciones/proj-1/editar',
				}),
			]),
		);
		expect(screen.getByRole('columnheader', { name: 'Invitación' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
	});

	it('shows metrics', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({ id: 'a', status: 'draft' }),
					makeItem({ id: 'b', status: 'published', published: true }),
				],
			}),
		);

		render(<InvitationList />);

		expect(screen.getByText('Activas')).toBeInTheDocument();
		// "Borradores" and "Publicadas" appear in both metrics and tabs
		const borradores = screen.getAllByText('Borradores');
		expect(borradores.length).toBeGreaterThanOrEqual(1);
		const publicadas = screen.getAllByText('Publicadas');
		expect(publicadas.length).toBeGreaterThanOrEqual(1);
	});

	it('renders overflow menu with correct actions for a demo', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({
						id: 'demo-1',
						kind: 'demo',
						title: 'Demo XV',
						published: true,
						slug: 'demo-xv',
					}),
				],
			}),
		);

		render(<InvitationList />);

		const moreButton = screen.getByLabelText('Más acciones');
		expect(moreButton).toBeInTheDocument();
		expect(moreButton).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(moreButton);
		expect(screen.getByText('Duplicar')).toBeInTheDocument();
		expect(screen.getByText('Copiar enlace público')).toBeInTheDocument();
		expect(screen.getByText('Archivar')).toBeInTheDocument();
	});

	it('renders overflow menu without duplicate for clients', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({
						id: 'client-1',
						kind: 'client',
						title: 'Boda Cliente',
					}),
				],
			}),
		);

		render(<InvitationList />);

		fireEvent.click(screen.getByLabelText('Más acciones'));
		expect(screen.queryByText('Duplicar')).not.toBeInTheDocument();
		expect(screen.getByText('Archivar')).toBeInTheDocument();
	});

	it('shows Vista link only when published', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({ id: 'pub', published: true, slug: 'mi-xv' }),
					makeItem({ id: 'draft', published: false }),
				],
			}),
		);

		render(<InvitationList />);

		const viewLinks = screen.getAllByText('Vista');
		expect(viewLinks).toHaveLength(1);
	});

	it('shows overflow menu with Archivar for active row', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({
						id: 'active-1',
						title: 'Invitación activa',
					}),
				],
			}),
		);

		render(<InvitationList />);

		const moreButton = screen.getByLabelText('Más acciones');
		fireEvent.click(moreButton);
		expect(screen.getByText('Archivar')).toBeInTheDocument();
		expect(screen.queryByText('Restaurar')).not.toBeInTheDocument();
		expect(screen.queryByText('Eliminar permanentemente')).not.toBeInTheDocument();
	});

	it('filters by search query with debounce', async () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({ id: '1', title: 'Boda Ana', clientName: 'Ana García' }),
					makeItem({ id: '2', title: 'XV Sofía', clientName: '' }),
				],
			}),
		);

		render(<InvitationList />);

		expect(screen.getByText('Boda Ana')).toBeInTheDocument();
		expect(screen.getByText('XV Sofía')).toBeInTheDocument();

		const searchInput = screen.getByPlaceholderText('Buscar por título o cliente...');
		fireEvent.change(searchInput, { target: { value: 'Sofía' } });

		await waitFor(() => {
			expect(screen.queryByText('Boda Ana')).not.toBeInTheDocument();
		});
		expect(screen.getByText('XV Sofía')).toBeInTheDocument();
	});

	it('shows creation CTA in empty state', () => {
		mockUseInvitationAdmin.mockReturnValue(makeMockAdmin({ items: [] }));

		render(<InvitationList />);

		const createLinks = screen.getAllByRole('link', { name: 'Nueva invitación' });
		expect(createLinks.length).toBeGreaterThanOrEqual(1);
	});

	it('shows tab buttons', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({ id: 'a', status: 'draft' }),
					makeItem({ id: 'b', status: 'published', published: true }),
				],
			}),
		);

		render(<InvitationList />);

		const allTab = screen.getByRole('button', { name: /Todas/ });
		expect(allTab).toBeInTheDocument();
	});

	it('shows skeleton rows while loading', () => {
		mockUseInvitationAdmin.mockReturnValue(makeMockAdmin({ loading: true }));

		const { container } = render(<InvitationList />);

		const skeletonRows = container.querySelectorAll('.intake-list__skeleton-row');
		expect(skeletonRows.length).toBe(4);
	});

	it('shows restore and delete for archived items', () => {
		const restoreInvitation = jest.fn();
		const permanentlyDeleteInvitation = jest.fn();
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({
						id: 'archived-1',
						title: 'Invitación archivada',
						archivedAt: '2026-05-28T00:00:00Z',
					}),
				],
				restoreInvitation,
				permanentlyDeleteInvitation,
			}),
		);

		render(<InvitationList />);

		fireEvent.click(screen.getByRole('button', { name: /Archivadas/ }));
		const moreButton = screen.getByLabelText('Más acciones');
		fireEvent.click(moreButton);
		expect(screen.getByText('Restaurar')).toBeInTheDocument();
		expect(screen.getByText('Eliminar permanentemente')).toBeInTheDocument();
		expect(screen.queryByText('Archivar')).not.toBeInTheDocument();
	});

	it('filters items when a tab is clicked', () => {
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [
					makeItem({ id: 'a', status: 'draft', title: 'Borrador' }),
					makeItem({ id: 'b', status: 'published', published: true, title: 'Publicada' }),
				],
			}),
		);

		render(<InvitationList />);

		expect(screen.getAllByText('Borrador').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('Publicada').length).toBeGreaterThanOrEqual(1);

		fireEvent.click(screen.getByRole('button', { name: /Borradores/ }));

		expect(screen.getAllByText('Borrador').length).toBeGreaterThanOrEqual(1);
		expect(screen.queryAllByText('Publicada').length).toBe(0);
	});

	it('displays action error when archive fails', async () => {
		const archiveInvitation = jest.fn().mockRejectedValue(new Error('Error de red'));
		mockUseInvitationAdmin.mockReturnValue(
			makeMockAdmin({
				items: [makeItem({ id: 'fail-1', title: 'Fallo' })],
				archiveInvitation,
			}),
		);

		render(<InvitationList />);

		const moreButton = screen.getByLabelText('Más acciones');
		fireEvent.click(moreButton);
		fireEvent.click(screen.getByText('Archivar'));

		const confirmButton = screen.getByText('Archivar');
		fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(screen.getByText('Error de red')).toBeInTheDocument();
		});
	});
});
