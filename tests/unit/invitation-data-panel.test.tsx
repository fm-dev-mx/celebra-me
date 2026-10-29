jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn() },
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import InvitationDataPanel, {
	type InvitationDataSummary,
} from '@/components/dashboard/commercial/InvitationDataPanel';

const mockGet = dashboardApi.get as jest.Mock;
const mockPost = dashboardApi.post as jest.Mock;

const submitted: InvitationDataSummary = {
	status: 'submitted',
	tokenIssuedAt: '2026-10-20T12:00:00.000Z',
	expiresAt: '2026-12-19T12:00:00.000Z',
	expired: false,
	lastSavedAt: '2026-10-26T18:00:00.000Z',
	submittedAt: '2026-10-26T18:00:00.000Z',
	ownerReviewedAt: null,
	needsReview: true,
	answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
};

beforeEach(() => {
	jest.clearAllMocks();
});

it('issues the link right after the deposit and offers it by WhatsApp', async () => {
	mockGet.mockResolvedValue({ ok: true, data: { data: null } });
	mockPost.mockResolvedValue({
		ok: true,
		data: {
			data: {
				url: 'https://www.celebra-me.com/mi-invitacion/abc',
				whatsappUrl: 'https://wa.me/526681112233?text=hola',
				expiresAt: '2026-12-25T00:00:00.000Z',
				summary: { ...submitted, status: 'sent', needsReview: false, answers: {} },
			},
		},
	});

	render(<InvitationDataPanel orderId="order-1" autoIssue />);

	expect(await screen.findByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute(
		'href',
		'https://wa.me/526681112233?text=hola',
	);
	expect(screen.getByLabelText('Enlace privado del formulario')).toHaveValue(
		'https://www.celebra-me.com/mi-invitacion/abc',
	);
	expect(mockPost).toHaveBeenCalledTimes(1);
	expect(mockPost).toHaveBeenCalledWith(
		'/api/dashboard/commercial/orders/order-1/invitation-data',
		{ action: 'issue-link' },
	);
});

it('shows received answers and clears the notice when reviewed', async () => {
	const onReviewed = jest.fn();
	mockGet.mockResolvedValue({ ok: true, data: { data: submitted } });
	mockPost.mockResolvedValue({
		ok: true,
		data: { data: { ...submitted, needsReview: false } },
	});

	render(<InvitationDataPanel orderId="order-1" onReviewed={onReviewed} />);

	expect(await screen.findByText('Datos recibidos · por revisar')).toBeInTheDocument();
	fireEvent.click(screen.getByRole('button', { name: 'Ver datos' }));
	expect(screen.getByText('Andrea')).toBeInTheDocument();

	fireEvent.click(screen.getByRole('button', { name: 'Marcar como revisado' }));
	await waitFor(() => expect(onReviewed).toHaveBeenCalledTimes(1));
	expect(screen.getByText('Datos recibidos · revisados')).toBeInTheDocument();
	expect(mockPost).toHaveBeenCalledWith(
		'/api/dashboard/commercial/orders/order-1/invitation-data',
		{ action: 'mark-reviewed' },
	);
});

it('shows uploaded photos in the answers list', async () => {
	const withPhotos: InvitationDataSummary = {
		...submitted,
		answers: {
			...submitted.answers,
			photos: [
				{
					id: '11111111-1111-4111-8111-111111111111',
					url: 'https://cdn.celebra-me.com/photo1.jpg',
					name: 'foto-principal.jpg',
					size: 102400,
					type: 'image/jpeg',
					uploadedAt: '2026-10-26T18:00:00.000Z',
				},
			],
		},
	};
	mockGet.mockResolvedValue({ ok: true, data: { data: withPhotos } });

	render(<InvitationDataPanel orderId="order-1" />);

	expect(await screen.findByText('Datos recibidos · por revisar')).toBeInTheDocument();
	fireEvent.click(screen.getByRole('button', { name: 'Ver datos' }));
	expect(screen.getByText(/Fotos para su invitación \(1\)/)).toBeInTheDocument();
	expect(screen.getByAltText('foto-principal.jpg')).toHaveAttribute(
		'src',
		'https://cdn.celebra-me.com/photo1.jpg',
	);
});
