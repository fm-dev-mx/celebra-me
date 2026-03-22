import { useEffect } from 'react';

/**
 * Behavior-only component that adds a click listener to the replay link
 * in the Footer to reset the envelope state and reload the page.
 */
export default function FooterReplayBehavior() {
	useEffect(() => {
		const replayLink = document.querySelector('.footer__replay-link') as HTMLElement;
		if (!replayLink) return;

		const handleReplayClick = () => {
			const slug = replayLink.dataset.slug;
			if (slug) {
				localStorage.removeItem(`envelope-opened-${slug}`);
				window.location.reload();
			}
		};

		replayLink.addEventListener('click', handleReplayClick);

		return () => {
			replayLink.removeEventListener('click', handleReplayClick);
		};
	}, []);

	return null;
}
