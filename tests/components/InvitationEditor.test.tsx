import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvitationEditor from '@/components/dashboard/intake/editor/InvitationEditor';
import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';

const saveSection = jest.fn();
const saveMetadata = jest.fn();
const publish = jest.fn();
const reconcileRsvp = jest.fn();

const context: InvitationEditorContextDTO = {
	invitation: {
		id: 'proj-1',
		kind: 'client',
		sourceInvitationId: null,
		slug: 'ana',
		title: 'XV Ana',
		eventType: 'xv',
		status: 'published',
		baseDemoId: 'demo-xv-jewelry-box',
		themeId: 'jewelry-box',
		clientName: 'Ana',
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: true,
		archivedAt: null,
		createdAt: '2026-05-30T00:00:00Z',
		updatedAt: '2026-05-30T01:00:00Z',
		snapshot: { previewSlug: 'demo-xv-jewelry-box' },
	},
	content: {
		title: 'XV Ana',
		hero: { name: 'Ana', date: '2027-01-01' },
		gallery: { title: 'Galería', items: [] },
		itinerary: { title: 'Programa', items: [] },
		sectionOrder: ['quote', 'gallery'],
	},
	draftUpdatedAt: '2026-05-30T02:00:00Z',
	draftStatus: 'approved',
	publication: {
		hasPublishedContent: true,
		version: 1,
		publishedAt: '2026-05-30T02:00:00Z',
		hasUnpublishedChanges: false,
	},
	rsvpLink: { status: 'linked', eventId: 'event-1' },
};

jest.mock('@/hooks/use-invitation-editor', () => ({
	useInvitationEditor: () => ({
		context,
		publishing: false,
		reconciling: false,
		savingSection: null,
		saveSection,
		saveMetadata,
		publish,
		reconcileRsvp,
	}),
}));

beforeEach(() => {
	jest.clearAllMocks();
	saveSection.mockResolvedValue({});
	saveMetadata.mockResolvedValue(context.invitation);
});

describe('InvitationEditor', () => {
	it('renders the section-based admin experience', () => {
		render(<InvitationEditor initialContext={context} />);

		expect(screen.getByRole('heading', { name: 'Datos principales' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Galería' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Publicación' })).toBeInTheDocument();
	});

	it('saves only the edited main section', async () => {
		const { container } = render(<InvitationEditor initialContext={context} />);
		const mainCard = container.querySelector('#main');
		expect(mainCard).not.toBeNull();

		fireEvent.change(within(mainCard as HTMLElement).getByLabelText('Título público'), {
			target: { value: 'XV Ana Samantha' },
		});
		fireEvent.click(within(mainCard as HTMLElement).getByText('Guardar sección'));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'main',
				expect.objectContaining({ title: 'XV Ana Samantha' }),
			);
		});
		expect(saveSection).toHaveBeenCalledTimes(1);
	});
});
