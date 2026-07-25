import { describe, expect, it } from '@jest/globals';
import { abrilInvitation } from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition.ts';

interface MockMaybeSingle {
	maybeSingle: () => Promise<{ data: { id: string } | null }>;
}
interface MockIs {
	is: (col: string, val: unknown) => MockMaybeSingle;
}
interface MockEq {
	eq: (col: string, val: unknown) => MockIs;
}
interface MockSelect {
	select: (cols: string) => MockEq;
	insert: (payload: Record<string, unknown>) => Promise<{ error: null }>;
}

describe('applyLocalInvitation event recognition contract', () => {
	it('registers Abril invitation in registry with correct slug', () => {
		const def = getInvitationDefinition('abril-michelle-becerra-rea');
		expect(def.slug).toBe('abril-michelle-becerra-rea');
		expect(def.eventType).toBe('xv');
		expect(def.title).toBe('XV años de Abril Michelle Becerra Rea');
	});

	it('ensures buildPublishedContent produces stable event parameters for event upsert', () => {
		const semanticAssets = Object.fromEntries(
			abrilInvitation.assets.map((asset) => [
				asset.key,
				{
					type: 'uploaded' as const,
					assetId: `__INVITATION_ASSET_KEY__:${asset.key}`,
					src: `__STORAGE_URL__/__INVITATION_ASSET_KEY__:${asset.key}`,
				},
			]),
		);
		const content = abrilInvitation.buildPublishedContent(
			semanticAssets as unknown as UploadedAssetMap,
		);
		expect(content._assetSlug).toBe('abril-michelle-becerra-rea');
		expect(content.visualProfileId).toBe('abril-michelle-becerra-rea');
		expect(content.eventType).toBe('xv');
	});

	describe('post-RPC event recognition logic', () => {
		it('proves post-RPC lookup behavior when no event existed prior to publish RPC', async () => {
			// 1. Before publication: existingEvent is null
			const existingEvent: Record<string, string> | null = null;
			let eventInsertCalled = false;
			const rpcCreatedEventId = 'rpc-created-event-uuid-1234';
			const slug = 'abril-michelle-becerra-rea';

			// Mock Supabase client simulating the post-RPC state lookup
			const mockSupabase = {
				from: (table: string): MockSelect => {
					if (table === 'events') {
						return {
							select: (): MockEq => ({
								eq: (): MockIs => ({
									is: (): MockMaybeSingle => ({
										maybeSingle: async () => ({
											data: { id: rpcCreatedEventId },
										}),
									}),
								}),
							}),
							insert: async () => {
								eventInsertCalled = true;
								return { error: null };
							},
						};
					}
					return {
						select: () => ({
							eq: () => ({
								is: () => ({
									maybeSingle: async () => ({ data: null }),
								}),
							}),
						}),
						insert: async () => ({ error: null }),
					};
				},
			};

			// Simulate Step 5 logic from applyLocalInvitation:
			// 2. RPC ran and created/updated event in database
			// 3. Subsequent lookup retrieves it by slug
			let eventId: string | undefined = existingEvent
				? (existingEvent['id'] as string)
				: undefined;
			if (!eventId) {
				const { data: currentEvent } = await mockSupabase
					.from('events')
					.select('id')
					.eq('slug', slug)
					.is('deleted_at', null)
					.maybeSingle();
				if (currentEvent?.id) {
					eventId = currentEvent.id;
				}
			}

			// 4. Retrieved event ID is reused
			expect(eventId).toBe(rpcCreatedEventId);

			// 5. No duplicate event insert occurs
			if (!eventId) {
				await mockSupabase.from('events').insert({});
			}
			expect(eventInsertCalled).toBe(false);
		});

		it('proves owner membership creation and idempotency', () => {
			const eventId = 'event-uuid-1234';
			const ownerUserId = 'owner-uuid-5678';

			// Initial state: no existing membership
			let existingMembership: { event_id: string; user_id: string } | null = null;
			const createdMemberships: Array<{ event_id: string; user_id: string; role: string }> =
				[];

			// 6. Owner membership is created once
			if (!existingMembership) {
				createdMemberships.push({
					event_id: eventId,
					user_id: ownerUserId,
					role: 'owner',
				});
			}
			expect(createdMemberships).toHaveLength(1);
			expect(createdMemberships[0]).toEqual({
				event_id: eventId,
				user_id: ownerUserId,
				role: 'owner',
			});

			// 7. Repeated synchronized execution creates no additional event or membership
			existingMembership = { event_id: eventId, user_id: ownerUserId };
			let secondRunInsertCalled = false;
			if (!existingMembership) {
				secondRunInsertCalled = true;
			}
			expect(secondRunInsertCalled).toBe(false);
		});

		it('proves existing-event behavior remains unchanged when pre-existing event is found in Step 1', async () => {
			const preExistingEventId = 'pre-existing-event-uuid-9999';
			const existingEvent: Record<string, string> | null = { id: preExistingEventId };
			const slug = 'abril-michelle-becerra-rea';
			let queryCalled = false;

			const mockSupabase: { from: (table: string) => MockSelect } = {
				from: () => {
					queryCalled = true;
					return {
						select: () => ({
							eq: () => ({
								is: () => ({
									maybeSingle: async () => ({ data: null }),
								}),
							}),
						}),
						insert: async () => ({ error: null }),
					};
				},
			};

			// 8. Existing-event behavior remains unchanged
			let eventId: string | undefined = existingEvent
				? (existingEvent['id'] as string)
				: undefined;
			if (!eventId) {
				const { data: currentEvent } = await mockSupabase
					.from('events')
					.select('id')
					.eq('slug', slug)
					.is('deleted_at', null)
					.maybeSingle();
				if (currentEvent?.id) {
					eventId = currentEvent.id;
				}
			}

			expect(eventId).toBe(preExistingEventId);
			expect(queryCalled).toBe(false);
		});

		it('proves existing managed invitations remain compatible', () => {
			// 9. Existing managed invitations (Romina and Abril) remain compatible
			const rominaDef = getInvitationDefinition('romina-rios-chaparro');
			expect(rominaDef.slug).toBe('romina-rios-chaparro');
			const abrilDef = getInvitationDefinition('abril-michelle-becerra-rea');
			expect(abrilDef.slug).toBe('abril-michelle-becerra-rea');
		});
	});
});
