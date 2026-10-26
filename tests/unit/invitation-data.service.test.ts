jest.mock('@/lib/invitation-data/repository', () => ({
	enqueueCompleteRegistration: jest.fn(),
	findInvitationDataOrder: jest.fn(),
	findInvitationDataRequestByOrderId: jest.fn(),
	findInvitationDataRequestByTokenHash: jest.fn(),
	listSubmittedInvitationData: jest.fn(),
	markInvitationDataReviewed: jest.fn(),
	saveInvitationDataAnswers: jest.fn(),
	upsertInvitationDataToken: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	deliverMetaConversionEvent: jest.fn(),
}));

import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import {
	enqueueCompleteRegistration,
	findInvitationDataOrder,
	findInvitationDataRequestByTokenHash,
	listSubmittedInvitationData,
	markInvitationDataReviewed,
	saveInvitationDataAnswers,
	upsertInvitationDataToken,
	type InvitationDataOrder,
	type InvitationDataRequest,
} from '@/lib/invitation-data/repository';
import {
	createInvitationDataToken,
	hashInvitationDataToken,
	issueInvitationDataLink,
	isWellFormedInvitationDataToken,
	listInvitationDataInbox,
	loadInvitationDataForm,
	markInvitationDataAsReviewed,
	needsOwnerReview,
	saveInvitationDataForm,
} from '@/lib/invitation-data/service';
import { ApiError } from '@/lib/rsvp/core/errors';

const mockFindOrder = jest.mocked(findInvitationDataOrder);
const mockUpsertToken = jest.mocked(upsertInvitationDataToken);
const mockFindByToken = jest.mocked(findInvitationDataRequestByTokenHash);
const mockSave = jest.mocked(saveInvitationDataAnswers);
const mockEnqueue = jest.mocked(enqueueCompleteRegistration);
const mockDeliver = jest.mocked(deliverMetaConversionEvent);
const mockMarkReviewed = jest.mocked(markInvitationDataReviewed);
const mockListSubmitted = jest.mocked(listSubmittedInvitationData);

const NOW = new Date('2026-10-26T18:00:00.000Z');
const TOKEN = 'A'.repeat(43);

const order: InvitationDataOrder = {
	id: 'order-1',
	orderNumber: 'CMO-20261026-ABC123',
	status: 'deposit_paid',
	eventType: 'xv',
	customerId: 'customer-1',
	leadId: 'lead-1',
	customerName: 'Gloria Garza',
	customerPhoneE164: '+526681112233',
	lead: { eventType: 'xv', eventDate: '2026-12-12', celebrantNames: 'Andrea' },
};

function request(overrides: Partial<InvitationDataRequest> = {}): InvitationDataRequest {
	return {
		id: 'request-1',
		orderId: 'order-1',
		tokenIssuedAt: '2026-10-26T17:00:00.000Z',
		expiresAt: '2026-12-25T17:00:00.000Z',
		answers: {},
		status: 'sent',
		lastSavedAt: null,
		submittedAt: null,
		ownerReviewedAt: null,
		...overrides,
	};
}

function afterContext() {
	const tasks: Promise<unknown>[] = [];
	return {
		tasks,
		after: { waitUntil: (promise: Promise<unknown>) => void tasks.push(promise) },
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe('invitation data tokens', () => {
	it('creates 43-character URL-safe tokens and hashes them to hex', () => {
		const token = createInvitationDataToken();
		expect(isWellFormedInvitationDataToken(token)).toBe(true);
		expect(createInvitationDataToken()).not.toBe(token);
		expect(hashInvitationDataToken(token)).toMatch(/^[a-f0-9]{64}$/u);
		expect(isWellFormedInvitationDataToken('short')).toBe(false);
		expect(isWellFormedInvitationDataToken(`${'A'.repeat(42)}/`)).toBe(false);
	});
});

describe('issueInvitationDataLink', () => {
	it('stores only the token hash and returns the link with a WhatsApp message', async () => {
		mockFindOrder.mockResolvedValue(order);
		mockUpsertToken.mockImplementation(async (input) =>
			request({ tokenIssuedAt: input.issuedAt, expiresAt: input.expiresAt }),
		);

		const link = await issueInvitationDataLink({
			orderId: 'order-1',
			origin: 'https://www.celebra-me.com',
			actorId: 'admin-1',
			now: NOW,
			token: TOKEN,
		});

		expect(mockUpsertToken).toHaveBeenCalledWith({
			orderId: 'order-1',
			tokenHash: hashInvitationDataToken(TOKEN),
			issuedAt: NOW.toISOString(),
			expiresAt: '2026-12-25T18:00:00.000Z',
			createdBy: 'admin-1',
		});
		expect(JSON.stringify(mockUpsertToken.mock.calls)).not.toContain(TOKEN);
		expect(link.url).toBe(`https://www.celebra-me.com/mi-invitacion/${TOKEN}`);
		expect(link.whatsappUrl).toMatch(/^https:\/\/wa\.me\/526681112233\?text=/u);
		expect(decodeURIComponent(link.whatsappUrl ?? '')).toContain(link.url);
		expect(link.expiresAt).toBe('2026-12-25T18:00:00.000Z');
	});

	it('returns no WhatsApp link when the customer has no usable phone', async () => {
		mockFindOrder.mockResolvedValue({ ...order, customerPhoneE164: null });
		mockUpsertToken.mockResolvedValue(request());
		const link = await issueInvitationDataLink({ orderId: 'order-1', origin: 'http://x.test' });
		expect(link.whatsappUrl).toBeNull();
	});

	it('refuses orders without a paid deposit and unknown orders', async () => {
		mockFindOrder.mockResolvedValueOnce({ ...order, status: 'confirmed' });
		await expect(
			issueInvitationDataLink({ orderId: 'order-1', origin: 'http://x.test' }),
		).rejects.toMatchObject({ status: 409 });

		mockFindOrder.mockResolvedValueOnce(null);
		await expect(
			issueInvitationDataLink({ orderId: 'missing', origin: 'http://x.test' }),
		).rejects.toMatchObject({ status: 404 });
		expect(mockUpsertToken).not.toHaveBeenCalled();
	});
});

describe('loadInvitationDataForm', () => {
	it('prefills from the lead under the saved answers', async () => {
		mockFindByToken.mockResolvedValue({
			request: request({ answers: { celebrantNames: 'Andrea Sofía', parents: 'Gloria' } }),
			order,
		});

		const state = await loadInvitationDataForm({ token: TOKEN, now: NOW });

		expect(mockFindByToken).toHaveBeenCalledWith(hashInvitationDataToken(TOKEN));
		expect(state.answers).toEqual({
			celebrantNames: 'Andrea Sofía',
			eventDate: '2026-12-12',
			parents: 'Gloria',
		});
		expect(state.eventType).toBe('xv');
	});

	it('answers 404 for malformed or replaced tokens and 410 once expired', async () => {
		await expect(loadInvitationDataForm({ token: 'nope' })).rejects.toMatchObject({
			status: 404,
		});
		expect(mockFindByToken).not.toHaveBeenCalled();

		mockFindByToken.mockResolvedValueOnce(null);
		await expect(loadInvitationDataForm({ token: TOKEN })).rejects.toMatchObject({
			status: 404,
		});

		mockFindByToken.mockResolvedValueOnce({
			request: request({ expiresAt: '2026-10-26T17:59:59.000Z' }),
			order,
		});
		await expect(loadInvitationDataForm({ token: TOKEN, now: NOW })).rejects.toMatchObject({
			status: 410,
		});
	});
});

describe('saveInvitationDataForm', () => {
	it('autosaves a draft as in progress without notifying Meta', async () => {
		mockFindByToken.mockResolvedValue({ request: request(), order });
		mockSave.mockResolvedValue(request({ status: 'in_progress', answers: { song: 'Vals' } }));
		const { after, tasks } = afterContext();

		await saveInvitationDataForm(
			{ token: TOKEN, answers: { song: ' Vals ', parents: '' }, now: NOW },
			{ after },
		);

		expect(mockSave).toHaveBeenCalledWith({
			requestId: 'request-1',
			tokenHash: hashInvitationDataToken(TOKEN),
			answers: { song: 'Vals' },
			status: 'in_progress',
			savedAt: NOW.toISOString(),
			firstSubmission: false,
			onlyIfUnsubmitted: true,
		});
		expect(tasks).toHaveLength(0);
	});

	it('rejects invalid answers and a submission without the required fields', async () => {
		mockFindByToken.mockResolvedValue({ request: request(), order });

		await expect(
			saveInvitationDataForm({ token: TOKEN, answers: { ceremonyTime: '7pm' } }),
		).rejects.toMatchObject({
			status: 400,
			details: { issues: { ceremonyTime: expect.any(String) } },
		});
		await expect(
			saveInvitationDataForm({ token: TOKEN, answers: { song: 'Vals' }, submit: true }),
		).rejects.toMatchObject({
			status: 400,
			details: {
				issues: { celebrantNames: expect.any(String), eventDate: expect.any(String) },
			},
		});
		expect(mockSave).not.toHaveBeenCalled();
	});

	it('marks the first submission and queues one CompleteRegistration after the response', async () => {
		mockFindByToken.mockResolvedValue({ request: request({ status: 'in_progress' }), order });
		mockSave.mockResolvedValue(
			request({ status: 'submitted', submittedAt: NOW.toISOString() }),
		);
		mockEnqueue.mockResolvedValue('outbox-1');
		mockDeliver.mockResolvedValue('sent');
		const { after, tasks } = afterContext();

		const state = await saveInvitationDataForm(
			{
				token: TOKEN,
				answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
				submit: true,
				now: NOW,
			},
			{ after },
		);
		await Promise.all(tasks);

		expect(state.status).toBe('submitted');
		expect(mockSave).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'submitted', firstSubmission: true }),
		);
		expect(mockEnqueue).toHaveBeenCalledWith({
			orderId: 'order-1',
			customerId: 'customer-1',
			leadId: 'lead-1',
		});
		expect(mockDeliver).toHaveBeenCalledWith('outbox-1');
	});

	it('keeps a received form received on later saves and re-queues Meta only on «Enviar»', async () => {
		mockFindByToken.mockResolvedValue({
			request: request({ status: 'submitted', submittedAt: '2026-10-26T17:30:00.000Z' }),
			order,
		});
		mockSave.mockResolvedValue(
			request({ status: 'submitted', submittedAt: '2026-10-26T17:30:00.000Z' }),
		);
		const { after, tasks } = afterContext();

		await saveInvitationDataForm(
			{
				token: TOKEN,
				answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
				submit: true,
			},
			{ after },
		);
		await saveInvitationDataForm({ token: TOKEN, answers: { song: 'Vals' } }, { after });

		expect(
			mockSave.mock.calls.map(([input]) => [
				input.status,
				input.firstSubmission,
				input.onlyIfUnsubmitted,
			]),
		).toEqual([
			['submitted', false, false],
			['submitted', false, false],
		]);
		// The re-submission retries the idempotent enqueue; the autosave does not.
		expect(tasks).toHaveLength(1);
	});

	it('saves as a later edit when another request won the first submission', async () => {
		mockFindByToken.mockResolvedValue({ request: request(), order });
		mockSave
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(
				request({ status: 'submitted', submittedAt: NOW.toISOString() }),
			);
		const { after, tasks } = afterContext();

		const state = await saveInvitationDataForm(
			{
				token: TOKEN,
				answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
				submit: true,
			},
			{ after },
		);

		expect(state.status).toBe('submitted');
		expect(mockSave).toHaveBeenLastCalledWith(
			expect.not.objectContaining({ firstSubmission: true }),
		);
		expect(tasks).toHaveLength(1);
	});

	it('never rolls a concurrent submission back to in progress', async () => {
		mockFindByToken.mockResolvedValue({ request: request({ status: 'in_progress' }), order });
		mockSave
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(
				request({ status: 'submitted', submittedAt: NOW.toISOString() }),
			);

		const state = await saveInvitationDataForm({ token: TOKEN, answers: { song: 'Vals' } });

		expect(
			mockSave.mock.calls.map(([input]) => [input.status, input.onlyIfUnsubmitted]),
		).toEqual([
			['in_progress', true],
			['submitted', undefined],
		]);
		expect(state.status).toBe('submitted');
	});

	it('fails like a replaced link when the token changed during the save', async () => {
		mockFindByToken.mockResolvedValue({ request: request(), order });
		mockSave.mockResolvedValue(null);
		await expect(
			saveInvitationDataForm({ token: TOKEN, answers: { song: 'Vals' } }),
		).rejects.toBeInstanceOf(ApiError);
	});

	it('keeps the client data when Meta queueing fails', async () => {
		mockFindByToken.mockResolvedValue({ request: request(), order });
		mockSave.mockResolvedValue(
			request({ status: 'submitted', submittedAt: NOW.toISOString() }),
		);
		mockEnqueue.mockRejectedValue(new Error('constraint violation'));
		const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const { after, tasks } = afterContext();

		await expect(
			saveInvitationDataForm(
				{
					token: TOKEN,
					answers: { celebrantNames: 'Andrea', eventDate: '2026-12-12' },
					submit: true,
				},
				{ after },
			),
		).resolves.toMatchObject({ status: 'submitted' });
		await Promise.all(tasks);
		expect(mockDeliver).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe('owner review', () => {
	it('needs review until the owner reviews the latest save', () => {
		expect(
			needsOwnerReview(request({ status: 'in_progress', lastSavedAt: NOW.toISOString() })),
		).toBe(false);
		const submitted = request({
			status: 'submitted',
			submittedAt: '2026-10-26T17:00:00.000Z',
			lastSavedAt: '2026-10-26T17:00:00.000Z',
		});
		expect(needsOwnerReview(submitted)).toBe(true);
		expect(
			needsOwnerReview({ ...submitted, ownerReviewedAt: '2026-10-26T17:05:00.000Z' }),
		).toBe(false);
		expect(
			needsOwnerReview({
				...submitted,
				ownerReviewedAt: '2026-10-26T17:05:00.000Z',
				lastSavedAt: '2026-10-26T17:10:00.000Z',
			}),
		).toBe(true);
	});

	it('lists only received forms that need review', async () => {
		mockListSubmitted.mockResolvedValue([
			{
				request: request({
					status: 'submitted',
					submittedAt: '2026-10-26T17:00:00.000Z',
					lastSavedAt: '2026-10-26T17:00:00.000Z',
					answers: { celebrantNames: 'Andrea' },
				}),
				order,
			},
			{
				request: request({
					id: 'request-2',
					status: 'submitted',
					submittedAt: '2026-10-26T16:00:00.000Z',
					lastSavedAt: '2026-10-26T16:00:00.000Z',
					ownerReviewedAt: '2026-10-26T16:30:00.000Z',
				}),
				order: { ...order, id: 'order-2' },
			},
		]);

		expect(await listInvitationDataInbox()).toEqual([
			{
				orderId: 'order-1',
				orderNumber: 'CMO-20261026-ABC123',
				customerId: 'customer-1',
				customerName: 'Gloria Garza',
				customerPhoneE164: '+526681112233',
				celebrantNames: 'Andrea',
				lastSavedAt: '2026-10-26T17:00:00.000Z',
				firstReview: true,
			},
		]);
	});

	it('marks a form as reviewed, or 404 without a link', async () => {
		mockMarkReviewed.mockResolvedValueOnce(
			request({
				status: 'submitted',
				submittedAt: '2026-10-26T17:00:00.000Z',
				lastSavedAt: '2026-10-26T17:00:00.000Z',
				ownerReviewedAt: NOW.toISOString(),
			}),
		);
		await expect(markInvitationDataAsReviewed('order-1', NOW)).resolves.toMatchObject({
			needsReview: false,
		});
		mockMarkReviewed.mockResolvedValueOnce(null);
		await expect(markInvitationDataAsReviewed('order-9', NOW)).rejects.toMatchObject({
			status: 404,
		});
	});
});
