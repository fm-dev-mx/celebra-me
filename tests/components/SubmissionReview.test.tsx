import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmissionReview from '@/components/dashboard/intake/SubmissionReview';

const mockLoadSubmissionForReview = jest.fn();
const mockReviewSubmission = jest.fn();
const mockSaveSubmissionCorrections = jest.fn().mockResolvedValue(undefined);
const mockCurrentProject = { title: 'XV Ana Sofia' };
const mockCurrentRequest = { enabledBlocks: ['event-details'] };
const mockCurrentSubmission = {
	id: 'sub-1',
	status: 'submitted',
	blockData: {
		'event-details': {
			celebrantName: 'Ana Sofia',
			secondaryName: '',
			eventLabel: 'Mis XV',
			eventDate: '2027-11-20T18:00:00Z',
			eventTitle: 'XV Ana Sofia',
			description: '',
			nickname: '',
		},
	},
	clientComments: 'Comentario inicial',
	reviewNotes: '',
	submittedAt: '2026-05-30T00:00:00Z',
};

jest.mock('@/hooks/use-invitation-admin', () => ({
	useInvitationAdmin: () => ({
		loading: false,
		error: '',
		currentInvitation: mockCurrentProject,
		currentRequest: mockCurrentRequest,
		currentSubmission: mockCurrentSubmission,
		loadSubmissionForReview: mockLoadSubmissionForReview,
		reviewSubmission: mockReviewSubmission,
		saveSubmissionCorrections: mockSaveSubmissionCorrections,
	}),
}));

describe('SubmissionReview', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('edits and saves corrected submission values through the admin action', async () => {
		render(<SubmissionReview invitationId="proj-1" />);

		await userEvent.click(screen.getByRole('button', { name: 'Editar correcciones' }));
		const celebrantName = screen.getByLabelText(/Nombre del festejado/);
		await userEvent.clear(celebrantName);
		await userEvent.type(celebrantName, 'Ana Sofia Corregida');
		await userEvent.click(screen.getByRole('button', { name: 'Guardar correcciones' }));

		await waitFor(() => {
			expect(mockSaveSubmissionCorrections).toHaveBeenCalledWith(
				'proj-1',
				expect.objectContaining({
					blockData: expect.objectContaining({
						'event-details': expect.objectContaining({
							celebrantName: 'Ana Sofia Corregida',
						}),
					}),
				}),
			);
		});
	});
});
