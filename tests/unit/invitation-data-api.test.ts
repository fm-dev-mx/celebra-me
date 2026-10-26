/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/invitation-data/service', () => ({
	getInvitationDataSummary: jest.fn(),
	issueInvitationDataLink: jest.fn(),
	listInvitationDataInbox: jest.fn(),
	loadInvitationDataForm: jest.fn(),
	markInvitationDataAsReviewed: jest.fn(),
	saveInvitationDataForm: jest.fn(),
}));

import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	getInvitationDataSummary,
	issueInvitationDataLink,
	listInvitationDataInbox,
	loadInvitationDataForm,
	markInvitationDataAsReviewed,
	saveInvitationDataForm,
} from '@/lib/invitation-data/service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { POST as publicPost } from '@/pages/api/mi-invitacion';
import { GET as getInbox } from '@/pages/api/dashboard/commercial/invitation-data';
import {
	GET as getOrderData,
	POST as postOrderData,
} from '@/pages/api/dashboard/commercial/orders/[orderId]/invitation-data';
import { createApiContext, createMockRequest } from '../helpers/api-mocks';

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
	fn as unknown as jest.MockedFunction<T>;

const TOKEN = 'a'.repeat(43);
const PUBLIC_URL = 'https://www.celebra-me.com/api/mi-invitacion';
const ORDER_URL =
	'https://www.celebra-me.com/api/dashboard/commercial/orders/order-id/invitation-data';

function publicCall(body: unknown) {
	return publicPost(createApiContext(createMockRequest(body, {}, PUBLIC_URL)) as never);
}

function orderCall(
	body: unknown,
	params: Record<string, string | undefined> = { orderId: 'order-id' },
) {
	return postOrderData(createApiContext(createMockRequest(body, {}, ORDER_URL), params) as never);
}

beforeEach(() => {
	jest.clearAllMocks();
	mocked(checkRateLimit).mockResolvedValue(true);
	mocked(requireAdminStrongSession).mockResolvedValue({ userId: 'admin-id' } as never);
	mocked(requireAdminMutationAccess).mockResolvedValue({ userId: 'admin-id' } as never);
	mocked(getInvitationDataSummary).mockResolvedValue({ status: 'sent' } as never);
});

describe('POST /api/mi-invitacion', () => {
	it('loads the form for a token, rate limited per IP', async () => {
		mocked(loadInvitationDataForm).mockResolvedValue({ status: 'sent', answers: {} } as never);

		const response = await publicCall({ token: TOKEN, action: 'load' });

		expect(response.status).toBe(200);
		expect(mocked(loadInvitationDataForm)).toHaveBeenCalledWith({ token: TOKEN });
		expect(mocked(checkRateLimit)).toHaveBeenCalledWith(
			expect.objectContaining({
				namespace: 'tracking',
				entityId: 'invitation-data',
				maxHits: 120,
			}),
		);
	});

	it('saves drafts and submits through the service', async () => {
		mocked(saveInvitationDataForm).mockResolvedValue({ status: 'in_progress' } as never);

		await publicCall({ token: TOKEN, action: 'save', answers: { celebrantNames: 'Andrea' } });
		await publicCall({ token: TOKEN, action: 'submit' });

		expect(mocked(saveInvitationDataForm).mock.calls.map(([input]) => input)).toEqual([
			{ token: TOKEN, answers: { celebrantNames: 'Andrea' }, submit: false },
			{ token: TOKEN, answers: {}, submit: true },
		]);
	});

	it('rejects unknown actions and oversized tokens before the service', async () => {
		expect((await publicCall({ token: TOKEN, action: 'delete' })).status).toBe(400);
		expect((await publicCall({ token: 'x'.repeat(65), action: 'load' })).status).toBe(400);
		expect(mocked(loadInvitationDataForm)).not.toHaveBeenCalled();
	});

	it('answers 429 when the rate limit is exhausted', async () => {
		mocked(checkRateLimit).mockResolvedValue(false);

		expect((await publicCall({ token: TOKEN, action: 'load' })).status).toBe(429);
		expect(mocked(loadInvitationDataForm)).not.toHaveBeenCalled();
	});

	it('passes service errors through, such as an expired link', async () => {
		mocked(loadInvitationDataForm).mockRejectedValue(
			new ApiError(410, 'invitation_unavailable', 'Este enlace ya venció.'),
		);

		expect((await publicCall({ token: TOKEN, action: 'load' })).status).toBe(410);
	});
});

describe('dashboard invitation data routes', () => {
	it('issues a link with the request origin and returns it once with the summary', async () => {
		mocked(issueInvitationDataLink).mockResolvedValue({
			url: 'https://www.celebra-me.com/mi-invitacion/abc',
			whatsappUrl: 'https://wa.me/526681112233?text=hola',
			expiresAt: '2026-12-25T00:00:00.000Z',
			request: {},
		} as never);

		const response = await orderCall({ action: 'issue-link' });
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mocked(requireAdminMutationAccess)).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			'commercial:invitation-data:write',
		);
		expect(mocked(issueInvitationDataLink)).toHaveBeenCalledWith({
			orderId: 'order-id',
			origin: 'https://www.celebra-me.com',
			actorId: 'admin-id',
		});
		expect(JSON.stringify(body)).toContain('/mi-invitacion/abc');
	});

	it('marks the answers as reviewed', async () => {
		mocked(markInvitationDataAsReviewed).mockResolvedValue({ status: 'submitted' } as never);

		expect((await orderCall({ action: 'mark-reviewed' })).status).toBe(200);
		expect(mocked(markInvitationDataAsReviewed)).toHaveBeenCalledWith('order-id');
		expect(mocked(issueInvitationDataLink)).not.toHaveBeenCalled();
	});

	it('refuses writes without mutation access', async () => {
		mocked(requireAdminMutationAccess).mockRejectedValue(
			new ApiError(403, 'forbidden', 'Forbidden'),
		);

		expect((await orderCall({ action: 'issue-link' })).status).toBe(403);
		expect(mocked(issueInvitationDataLink)).not.toHaveBeenCalled();
	});

	it('reads the summary and the inbox behind a strong session', async () => {
		mocked(listInvitationDataInbox).mockResolvedValue([] as never);

		const summary = await getOrderData(
			createApiContext(createMockRequest(undefined, {}, ORDER_URL), {
				orderId: 'order-id',
			}) as never,
		);
		const inbox = await getInbox(
			createApiContext(createMockRequest(undefined, {}, ORDER_URL)) as never,
		);

		expect(summary.status).toBe(200);
		expect(inbox.status).toBe(200);
		expect(mocked(requireAdminStrongSession)).toHaveBeenCalledTimes(2);
	});
});
