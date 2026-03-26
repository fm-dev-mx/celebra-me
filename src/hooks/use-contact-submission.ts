import { useCallback, useState } from 'react';
import { rsvpApi, type ContactPayload } from '@/lib/client/rsvp-api';

export function useContactSubmission() {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [submitted, setSubmitted] = useState(false);

	const submitContact = useCallback(async (payload: ContactPayload) => {
		setSubmitting(true);
		setError('');

		try {
			await rsvpApi.submitContact(payload);
			setSubmitted(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'No se pudo enviar tu mensaje.');
			throw err;
		} finally {
			setSubmitting(false);
		}
	}, []);

	const resetContactSubmission = useCallback(() => {
		setSubmitting(false);
		setError('');
		setSubmitted(false);
	}, []);

	return {
		submitting,
		error,
		submitted,
		submitContact,
		resetContactSubmission,
	};
}
