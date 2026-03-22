import { useEffect } from 'react';

interface Props {
	eventSlug: string;
}

/**
 * Behavior-only component that checks localStorage to see if the invitation
 * envelope has already been opened, and updates the body class accordingly.
 */
export default function EnvelopeSyncBehavior({ eventSlug }: Props) {
	useEffect(() => {
		const key = `envelope-opened-${eventSlug}`;
		if (localStorage.getItem(key) === 'true') {
			document.body.classList.add('invitation-revealed');
		}
	}, [eventSlug]);

	return null;
}
