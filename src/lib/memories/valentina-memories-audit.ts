import {
	VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS,
	type ValentinaMemoriesMediaActor,
} from '@/data/valentina-memories-media.contract';
import { VALENTINA_MEMORIES_EVENT_ID } from '@/data/valentina-memories-upload.contract';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export async function appendValentinaMemoriesAudit(input: {
	mediaItemId?: string;
	actorType: ValentinaMemoriesMediaActor;
	actorId?: string;
	action: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: 'valentina_memory_audit_events',
		method: 'POST',
		useServiceRole: true,
		body: {
			event_key: VALENTINA_MEMORIES_EVENT_ID,
			media_item_id: input.mediaItemId ?? null,
			actor_type: input.actorType,
			actor_id: input.actorId ?? null,
			action: input.action,
			metadata: input.metadata ?? {},
			expires_at: new Date(
				Date.now() + VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS * 1000,
			).toISOString(),
		},
	});
}

export async function recordValentinaMemoryAccess(input: {
	mediaItemId: string;
	actorType: 'guest' | 'organizer';
	actorId?: string;
	mode: 'inline' | 'attachment';
}): Promise<void> {
	await appendValentinaMemoriesAudit({
		mediaItemId: input.mediaItemId,
		actorType: input.actorType,
		actorId: input.actorId,
		action: input.mode === 'attachment' ? 'download_requested' : 'preview_requested',
	});
}
