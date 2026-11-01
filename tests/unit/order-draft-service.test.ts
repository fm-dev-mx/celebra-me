jest.mock('@/lib/invitation-data/repository');
jest.mock('@/lib/invitation-data/draft-repository');
jest.mock('@/lib/intake/repositories/invitation.repository');
jest.mock('@/lib/intake/repositories/invitation-content-draft.repository');

import { createOrderDraft, getOrderDraftOptions } from '@/lib/invitation-data/draft-service';
import { buildOrderDraftContent } from '@/lib/invitation-data/draft-content';
import {
	findInvitationDataOrder,
	findInvitationDataRequestByOrderId,
} from '@/lib/invitation-data/repository';
import {
	createOrderDraftAtomic,
	findOrderInvitationId,
} from '@/lib/invitation-data/draft-repository';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { mergePublishedWithDraft } from '@/lib/intake/services/merge-content.service';

const orderId = 'b4000000-0000-4000-8000-000000000001';
beforeEach(() => {
	jest.resetAllMocks();
	jest.mocked(findInvitationDataOrder).mockResolvedValue({
		id: orderId,
		status: 'paid',
		eventType: 'xv',
	} as never);
	jest.mocked(findOrderInvitationId).mockResolvedValue(null);
	jest.mocked(findInvitationDataRequestByOrderId).mockResolvedValue({
		status: 'submitted',
		submittedAt: '2026-10-30',
		updatedAt: '2026-10-30T16:00:00Z',
		answers: { celebrantNames: 'María & Ana', eventDate: '2026-12-12' },
	} as never);
	jest.mocked(createOrderDraftAtomic).mockResolvedValue({
		invitationId: 'invitation-id',
		created: true,
	});
});

it('offers only verified presets for the order event type', async () => {
	const result = await getOrderDraftOptions(orderId);
	expect(result.presets).toContain('editorial');
	expect(result.presets).not.toContain('jewelry-box-wedding');
});

it.each(['', 'jewelry-box-wedding', 'unknown'])(
	'rejects missing/incompatible preset %s',
	async (themeId) => {
		await expect(createOrderDraft(orderId, themeId)).rejects.toMatchObject({ status: 400 });
		expect(createOrderDraftAtomic).not.toHaveBeenCalled();
	},
);

it('creates a normalized draft without an event-type slug prefix or publication', async () => {
	expect(await createOrderDraft(orderId, 'editorial')).toMatchObject({
		created: true,
		editorUrl: '/dashboard/invitaciones/invitation-id/editar',
	});
	expect(createOrderDraftAtomic).toHaveBeenCalledWith(
		expect.objectContaining({
			orderId,
			themeId: 'editorial',
			slug: `maria-ana-${orderId}`,
			content: expect.objectContaining({
				hero: expect.objectContaining({ name: 'María & Ana', date: '2026-12-12' }),
			}),
		}),
	);
});

it('opens an existing draft without requiring a new preset or overwriting edits', async () => {
	jest.mocked(findOrderInvitationId).mockResolvedValue('existing-id');
	jest.mocked(findInvitationById).mockResolvedValue({ id: 'existing-id' } as never);
	jest.mocked(findDraftByInvitationId).mockResolvedValue({ id: 'draft-id' } as never);
	expect(await createOrderDraft(orderId, '')).toMatchObject({
		invitationId: 'existing-id',
		created: false,
	});
	expect(createOrderDraftAtomic).not.toHaveBeenCalled();
	expect(findInvitationDataRequestByOrderId).not.toHaveBeenCalled();
});

it('does not silently replace an archived or missing linked draft', async () => {
	jest.mocked(findOrderInvitationId).mockResolvedValue('existing-id');
	jest.mocked(findInvitationById).mockResolvedValue(null);
	await expect(createOrderDraft(orderId, 'editorial')).rejects.toMatchObject({ status: 409 });
	expect(createOrderDraftAtomic).not.toHaveBeenCalled();
});

it('rejects unpaid or unsubmitted orders', async () => {
	jest.mocked(findInvitationDataOrder).mockResolvedValue({
		status: 'confirmed',
		eventType: 'xv',
	} as never);
	await expect(createOrderDraft(orderId, 'editorial')).rejects.toMatchObject({ status: 409 });
	jest.mocked(findInvitationDataOrder).mockResolvedValue({
		status: 'paid',
		eventType: 'xv',
	} as never);
	jest.mocked(findInvitationDataRequestByOrderId).mockResolvedValue({
		status: 'in_progress',
	} as never);
	await expect(createOrderDraft(orderId, 'editorial')).rejects.toMatchObject({ status: 409 });
	expect(createOrderDraftAtomic).not.toHaveBeenCalled();
});

it('reports an atomic stale-data rejection instead of returning a nonexistent draft', async () => {
	jest.mocked(createOrderDraftAtomic).mockResolvedValue({ error: 'stale' });
	await expect(createOrderDraft(orderId, 'editorial')).rejects.toMatchObject({ status: 409 });
});

it('maps locations, text, family, song and photos without inventing audio or itinerary', () => {
	const draft = buildOrderDraftContent(
		{
			celebrantNames: 'Celebrante',
			eventDate: '2026-12-12',
			mainMessage: 'Mensaje',
			parents: 'Familia',
			godparents: 'Padrinos',
			ceremonyVenue: 'Templo',
			ceremonyTime: '18:00',
			receptionAddress: 'Domicilio',
			song: 'Canción solicitada',
			itinerary: 'Cena y baile',
			giftTransfer: 'Consultar',
			photos: [
				{
					id: orderId,
					url: 'https://cdn.example.test/photo.webp',
					name: 'Foto',
					size: 100,
					type: 'image/webp',
				},
			],
		},
		'xv',
	);
	expect(draft.thankYou?.message).toBe('Mensaje');
	expect(draft.location?.venues).toHaveLength(2);
	expect(draft.music).toEqual({ title: 'Canción solicitada' });
	expect(draft.gallery?.items).toHaveLength(1);
	expect(draft.itinerary).toBeUndefined();
	expect(draft.photoNotes).toBeUndefined();
});

it('never publishes the private order snapshot', () => {
	const content = mapDraftToPublished({
		invitation: { title: 'Test', eventType: 'xv' },
		themePreset: 'editorial',
		draftContent: {
			sectionOrder: ['thankYou'],
			orderSource: {
				orderId,
				packageName: 'Esencial',
				answers: { notes: 'Private instructions' },
			},
		},
		priorPublishedContent: {
			composition: { intersections: {} },
			hero: { variant: 'standard', name: 'Test' },
		},
	});
	expect(content).not.toHaveProperty('orderSource');
	expect(JSON.stringify(content)).not.toContain('Private instructions');
});

it('keeps original instructions available after editor hydration', () => {
	const orderSource = {
		orderId,
		packageName: 'Esencial',
		answers: { notes: 'Review these instructions', itinerary: 'Cena y baile' },
	};
	expect(mergePublishedWithDraft({}, { orderSource }).content.orderSource).toEqual(orderSource);
	expect(mergePublishedWithDraft({ orderSource }, {}).content.orderSource).toBeUndefined();
});
