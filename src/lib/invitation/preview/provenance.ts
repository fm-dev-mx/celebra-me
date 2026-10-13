/**
 * Opaque, non-reversible reference to an invitation, embedded in watermarked preview
 * media and in the invitation markup. It lets Celebra-me tie a leaked preview or a
 * copied page back to its invitation without exposing the invitation id or the client.
 */
import { createHash } from 'node:crypto';

export function invitationProvenanceReference(invitationId: string): string {
	return createHash('sha256')
		.update(`celebra-me:preview:${invitationId}`)
		.digest('hex')
		.slice(0, 12);
}
