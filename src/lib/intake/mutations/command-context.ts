import type { InvitationMutationEnvironment } from '@/lib/intake/mutations/environment-identity';
import type { MutationActorType, MutationOrigin } from '@/lib/intake/mutations/outcome';

export interface InvitationMutationCommandContext {
	operationId: string;
	environment: InvitationMutationEnvironment;
	projectRef: string;
	actorId: string | null;
	actorType: MutationActorType;
	origin: MutationOrigin;
	retryOfOperationId?: string;
}
