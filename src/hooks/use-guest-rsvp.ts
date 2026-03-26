import { useCallback, useState } from 'react';
import { rsvpApi, type RsvpPayload } from '@/lib/client/rsvp-api';

export function useGuestRsvp(inviteId: string, initialSubmitted = false) {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [submitted, setSubmitted] = useState(initialSubmitted);

	const markInviteViewed = useCallback(async () => {
		try {
			await rsvpApi.markViewed(inviteId);
		} catch {
			// View telemetry should remain non-blocking.
		}
	}, [inviteId]);

	const submitGuestRsvp = useCallback(
		async (payload: RsvpPayload) => {
			setSubmitting(true);
			setError('');

			try {
				const result = await rsvpApi.submitRsvp(inviteId, payload);
				setSubmitted(true);
				return result;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'No se pudo guardar la confirmación.',
				);
				throw err;
			} finally {
				setSubmitting(false);
			}
		},
		[inviteId],
	);

	const resetGuestRsvp = useCallback(() => {
		setSubmitting(false);
		setError('');
		setSubmitted(false);
	}, []);

	return {
		submitting,
		error,
		submitted,
		markInviteViewed,
		submitGuestRsvp,
		resetGuestRsvp,
	};
}
