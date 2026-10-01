import { MEMORIES_AUDIT_RETENTION_SECONDS } from '@/lib/memories/contract/limits';
import type { MemoriesMediaActor } from '@/lib/memories/contract/catalog';
import { insertAudit } from './catalog.repository';

/** Audit rows carry no names, captions, keys or addresses: only opaque ids and actions. */
export async function appendMemoriesAudit(input: {
	eventId: string;
	mediaItemId?: string;
	actorType: MemoriesMediaActor;
	actorId?: string;
	action: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await insertAudit({
		eventId: input.eventId,
		mediaItemId: input.mediaItemId ?? null,
		actorType: input.actorType,
		actorId: input.actorId ?? null,
		action: input.action,
		metadata: input.metadata ?? {},
		expiresAt: new Date(Date.now() + MEMORIES_AUDIT_RETENTION_SECONDS * 1000).toISOString(),
	});
}

export async function recordMemoriesAccess(input: {
	eventId: string;
	mediaItemId: string;
	actorType: 'guest' | 'organizer';
	actorId?: string;
	mode: 'inline' | 'attachment';
}): Promise<void> {
	await appendMemoriesAudit({
		eventId: input.eventId,
		mediaItemId: input.mediaItemId,
		actorType: input.actorType,
		actorId: input.actorId,
		action: input.mode === 'attachment' ? 'download_requested' : 'preview_requested',
	});
}
