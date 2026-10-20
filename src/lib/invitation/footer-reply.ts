/*
  Reply at the end of the invitation (`--invitation-footer-reply: on` on `.footer-reply`;
  Footer.astro renders it hidden at the top of the footer). While the guest has not answered it
  asks once more, under a lit lantern, and leads to the RSVP; after a yes it keeps only a short
  line of thanks (when the profile gives one); after a decline, or on a card locked to personal
  passes, it stays away. It reads the state the RSVP card already shows (`.rsvp[data-state]`), so
  nothing new is sent or stored. The words come from the profile (see _footer.scss).
*/

export type FooterReplyMode = 'pending' | 'answered' | 'none';

const RSVP_SELECTOR = '#rsvp .rsvp[data-state]';
const FIELD_SELECTOR = 'input:not([type="hidden"]), select, textarea, button';

export function isFooterReplyOn(value: string): boolean {
	return value.trim() === 'on';
}

/**
 * What the footer offers for the RSVP card's state: the reply while the form is open, the line of
 * thanks after a yes when there is one, nothing otherwise.
 */
export function footerReplyMode(
	rsvpState: string | null | undefined,
	hasAnsweredLine: boolean,
): FooterReplyMode {
	if (rsvpState === 'form') return 'pending';
	if (rsvpState === 'confirmed' && hasAnsweredLine) return 'answered';
	return 'none';
}

/** Whether a `content` token holds words (anything but `none` or empty). */
export function hasContentToken(value: string): boolean {
	const trimmed = value.trim();
	return trimmed !== '' && trimmed !== 'none';
}

export function initFooterReply(root: Element | null): void {
	if (!(root instanceof HTMLElement)) return;
	const styles = getComputedStyle(root);
	if (!isFooterReplyOn(styles.getPropertyValue('--invitation-footer-reply'))) return;
	const pending = root.querySelector<HTMLElement>('[data-footer-reply-pending]');
	const answered = root.querySelector<HTMLElement>('[data-footer-reply-answered]');
	const confirm = root.querySelector<HTMLAnchorElement>('[data-footer-reply-confirm]');
	const rsvpSection = document.getElementById('rsvp');
	if (!pending || !answered || !confirm || !rsvpSection) return;

	const hasAnsweredLine = hasContentToken(styles.getPropertyValue('--footer-reply-answered'));
	const update = () => {
		const state = document.querySelector<HTMLElement>(RSVP_SELECTOR)?.dataset.state;
		const mode = footerReplyMode(state, hasAnsweredLine);
		root.hidden = mode === 'none';
		root.dataset.mode = mode;
		pending.hidden = mode !== 'pending';
		answered.hidden = mode !== 'answered';
	};

	// Back up to the RSVP, with the first field ready for the guest's answer.
	confirm.addEventListener('click', (event) => {
		const card = document.querySelector<HTMLElement>(RSVP_SELECTOR);
		if (!card) return;
		event.preventDefault();
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		rsvpSection.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
		card.querySelector<HTMLElement>(FIELD_SELECTOR)?.focus({ preventScroll: true });
		history.replaceState(null, '', '#rsvp');
	});

	new MutationObserver(update).observe(rsvpSection, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ['data-state'],
	});
	update();
}
