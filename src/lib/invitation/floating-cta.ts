/*
  Floating reply button. Footer.astro renders it hidden; it turns on with
  `--invitation-floating-cta: on` on `.floating-cta`, or by default on a personal link
  (`data-floating-cta-default`) unless the profile sets `--invitation-floating-cta: off`. While the guest has not answered it reads "Confirmar asistencia" and leads to the
  RSVP; once they confirm it becomes "Agendar" and opens the venues' calendar choices, copied from
  the location section; after a decline, or on a card locked to personal passes, it stays away. It reads the state the RSVP card already
  shows (`.rsvp[data-state]`), so nothing new is sent or stored.

  It shows once the cover is behind the guest and steps aside while the RSVP is on screen, near
  the end of the page (where the held footer's pull begins) and while the menu is open.
*/

export type FloatingCtaMode = 'confirm' | 'calendar' | 'none';

const RSVP_SELECTOR = '#rsvp .rsvp[data-state]';
const CALENDAR_SELECTOR = '.event-location__calendar';
// Past this share of the first screen the cover counts as behind the guest.
const COVER_SHARE = 0.6;
// Within this share of a screen from the end, the page is ending.
const END_SHARE = 0.75;

export function isFloatingCtaOn(value: string, byDefault = false): boolean {
	const token = value.trim();
	return token === 'on' || (byDefault && token !== 'off');
}

/**
 * What the button offers for the RSVP card's state: the reply while the form is open, the
 * calendar after a yes, nothing otherwise (a decline, or a card locked to personal passes).
 */
export function floatingCtaMode(
	rsvpState: string | null | undefined,
	hasCalendar: boolean,
): FloatingCtaMode {
	if (rsvpState === 'form') return 'confirm';
	if (rsvpState === 'confirmed' && hasCalendar) return 'calendar';
	return 'none';
}

export function isInFloatingZone(
	scrollY: number,
	viewportHeight: number,
	scrollHeight: number,
): boolean {
	const pastCover = scrollY > viewportHeight * COVER_SHARE;
	const beforeEnd = scrollY + viewportHeight < scrollHeight - viewportHeight * END_SHARE;
	return pastCover && beforeEnd;
}

// One group per venue: its heading (the venue's event) and a copy of its calendar links.
function fillCalendarPanel(panel: HTMLElement, sources: HTMLElement[]): void {
	panel.replaceChildren(
		...sources.map((details) => {
			const group = document.createElement('div');
			group.className = 'floating-cta__group';
			const heading = document.createElement('p');
			heading.className = 'floating-cta__group-title';
			heading.textContent =
				details.closest('article')?.querySelector('h3')?.textContent?.trim() ?? 'Evento';
			const options = details.querySelector('ul')?.cloneNode(true) as HTMLElement | undefined;
			if (options) options.className = 'floating-cta__options';
			group.append(heading, ...(options ? [options] : []));
			return group;
		}),
	);
}

export function initFloatingCta(root: Element | null): void {
	if (!(root instanceof HTMLElement)) return;
	const token = getComputedStyle(root).getPropertyValue('--invitation-floating-cta');
	if (!isFloatingCtaOn(token, root.dataset.floatingCtaDefault === 'on')) return;
	const confirm = root.querySelector<HTMLAnchorElement>('[data-floating-cta-confirm]');
	const calendar = root.querySelector<HTMLButtonElement>('[data-floating-cta-calendar]');
	const panel = root.querySelector<HTMLElement>('[data-floating-cta-panel]');
	const rsvpSection = document.getElementById('rsvp');
	if (!confirm || !calendar || !panel || !rsvpSection) return;

	const sources = [...document.querySelectorAll<HTMLElement>(CALENDAR_SELECTOR)];
	fillCalendarPanel(panel, sources);
	const docRoot = document.documentElement;
	const menu = document.querySelector<HTMLElement>('[data-nav-mobile-menu]');
	let rsvpOnScreen = false;
	let frame = 0;
	// The mode the light last crossed the pill for: once on first showing, again on Agendar.
	let glinted: FloatingCtaMode = 'none';
	let glintTimer = 0;

	const setPanel = (open: boolean, returnFocus = false) => {
		panel.hidden = !open;
		calendar.setAttribute('aria-expanded', String(open));
		if (!open && returnFocus) calendar.focus();
	};

	const update = () => {
		frame = 0;
		const state = document.querySelector<HTMLElement>(RSVP_SELECTOR)?.dataset.state;
		const mode = floatingCtaMode(state, sources.length > 0);
		confirm.hidden = mode !== 'confirm';
		calendar.hidden = mode !== 'calendar';
		const menuOpen = menu?.dataset.state === 'open';
		const visible =
			mode !== 'none' &&
			!rsvpOnScreen &&
			!menuOpen &&
			isInFloatingZone(window.scrollY, window.innerHeight, docRoot.scrollHeight);
		if (!visible && !panel.hidden) setPanel(false);
		if (visible && mode !== glinted) {
			glinted = mode;
			root.dataset.glint = mode;
			window.clearTimeout(glintTimer);
			glintTimer = window.setTimeout(() => delete root.dataset.glint, 1600);
		}
		root.dataset.visible = String(visible);
		root.inert = !visible;
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};

	root.hidden = false;
	new IntersectionObserver(([entry]) => {
		rsvpOnScreen = Boolean(entry?.isIntersecting);
		schedule();
	}).observe(rsvpSection);
	new MutationObserver(schedule).observe(rsvpSection, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ['data-state'],
	});
	if (menu)
		new MutationObserver(schedule).observe(menu, {
			attributes: true,
			attributeFilter: ['data-state'],
		});
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule, { passive: true });

	calendar.addEventListener('click', () => setPanel(panel.hidden !== false));
	panel.addEventListener('click', (event) => {
		if ((event.target as Element | null)?.closest('a')) setPanel(false);
	});
	root.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !panel.hidden) setPanel(false, true);
	});
	document.addEventListener('click', (event) => {
		if (!panel.hidden && !root.contains(event.target as Node)) setPanel(false);
	});
	update();
}
