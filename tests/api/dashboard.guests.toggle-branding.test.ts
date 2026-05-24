jest.mock('@/lib/rsvp/auth/auth', () => ({
	getSessionContextFromRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/rsvp/services/dashboard-guests.service', () => ({
	toggleGuestBrandingRemoval: jest.fn(),
}));

import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import { toggleGuestBrandingRemoval } from '@/lib/rsvp/services/dashboard-guests.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { POST } from '@/pages/api/dashboard/guests/[guestId]/toggle-branding';

function createMockRequest({
	method = 'POST',
	body = {},
	guestId = 'guest-1',
}: {
	method?: string;
	body?: Record<string, unknown>;
	guestId?: string;
}): [Request, Record<string, string>, URL] {
	const request = new Request(
		`http://localhost/api/dashboard/guests/${guestId}/toggle-branding`,
		{
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		},
	);
	const params = { guestId };
	const url = new URL(`http://localhost/api/dashboard/guests/${guestId}/toggle-branding`);
	return [request, params, url];
}

describe('POST /api/dashboard/guests/[guestId]/toggle-branding', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue(null);

		const [request, params, url] = createMockRequest({ body: { hideCelebraMeBranding: true } });
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(401);
	});

	it('returns 400 when hideCelebraMeBranding is not a boolean', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue({
			userId: 'user-1',
			accessToken: 'token-1',
		});

		const [request, params, url] = createMockRequest({
			body: { hideCelebraMeBranding: 'yes' },
		});
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(400);
	});

	it('returns 200 and calls the service when enabling under the limit', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue({
			userId: 'user-1',
			accessToken: 'token-1',
		});
		(toggleGuestBrandingRemoval as jest.Mock).mockResolvedValue({
			item: { guestId: 'guest-1', hideCelebraMeBranding: true },
			updatedAt: '2026-01-01T00:00:00.000Z',
			source: 'mutation',
		});

		const [request, params, url] = createMockRequest({ body: { hideCelebraMeBranding: true } });
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.item.hideCelebraMeBranding).toBe(true);
		expect(toggleGuestBrandingRemoval).toHaveBeenCalledWith(
			expect.objectContaining({
				guestId: 'guest-1',
				hideCelebraMeBranding: true,
				hostAccessToken: 'token-1',
			}),
		);
	});

	it('returns 200 and calls the service when disabling at the limit', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue({
			userId: 'user-1',
			accessToken: 'token-1',
		});
		(toggleGuestBrandingRemoval as jest.Mock).mockResolvedValue({
			item: { guestId: 'guest-1', hideCelebraMeBranding: false },
			updatedAt: '2026-01-01T00:00:00.000Z',
			source: 'mutation',
		});

		const [request, params, url] = createMockRequest({
			body: { hideCelebraMeBranding: false },
		});
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.item.hideCelebraMeBranding).toBe(false);
		expect(toggleGuestBrandingRemoval).toHaveBeenCalledWith(
			expect.objectContaining({
				guestId: 'guest-1',
				hideCelebraMeBranding: false,
			}),
		);
	});

	it('returns 400 when the service throws a limit_reached error', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue({
			userId: 'user-1',
			accessToken: 'token-1',
		});
		(toggleGuestBrandingRemoval as jest.Mock).mockRejectedValue(
			new ApiError(
				400,
				'bad_request' as const,
				'Límite alcanzado: esta invitación permite ocultar la marca en máximo 5 invitados.',
			),
		);

		const [request, params, url] = createMockRequest({ body: { hideCelebraMeBranding: true } });
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error.message).toContain('Límite alcanzado');
	});

	it('returns 403 when the service rejects ineligible event', async () => {
		(getSessionContextFromRequest as jest.Mock).mockResolvedValue({
			userId: 'user-1',
			accessToken: 'token-1',
		});
		(toggleGuestBrandingRemoval as jest.Mock).mockRejectedValue(
			new ApiError(
				403,
				'forbidden' as const,
				'Esta función no está disponible para este evento.',
			),
		);

		const [request, params, url] = createMockRequest({ body: { hideCelebraMeBranding: true } });
		const response = await POST({ request, params, url } as never);
		expect(response.status).toBe(403);

		const data = await response.json();
		expect(data.error.message).toContain('no está disponible');
	});
});
