import { randomUUID } from 'node:crypto';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import type { MutationOrigin } from '@/lib/intake/mutations/outcome';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { assertRuntimeMutationEnvironment } from '@/lib/server/runtime-mutation-environment';

export async function createRuntimeMutationCommandContext(
	session: SessionContext,
	origin: Extract<MutationOrigin, 'editor' | 'legacy_dashboard' | 'system'>,
	operationId: string = randomUUID(),
	retryOfOperationId?: string,
): Promise<InvitationMutationCommandContext> {
	const identity = await assertRuntimeMutationEnvironment();
	return {
		operationId,
		environment: identity.environment,
		projectRef: identity.projectRef,
		actorId: session.userId,
		actorType: session.isSuperAdmin ? 'admin' : 'host',
		origin,
		...(retryOfOperationId ? { retryOfOperationId } : {}),
	};
}
