import { daysUntil, eventFromHash, withWhatsAppText } from '@/lib/landing/vitrina';

/**
 * Landing showroom behavior. The markup is complete without it (first event and demo visible);
 * this switches events, demos and the device frame by toggling `hidden`, follows `#<event>`
 * links, and tells the sticky bar and the header CTA which demo is shown so their WhatsApp
 * messages carry `Ref. EVENT-STYLE-BARRA` / `-HEADER`.
 */

export interface VitrinaChangeDetail {
	slug: string;
	label: string;
	barMessage: string;
	thumbSrc: string;
}

export const VITRINA_CHANGE_EVENT = 'vitrina:change';

const prefersReducedMotion = () =>
	window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function initLandingShowroom(root: Document = document): void {
	const section = root.querySelector<HTMLElement>('[data-vitrina]');
	if (!section) return;

	const eventSlugs = [
		...new Set(
			[...section.querySelectorAll<HTMLElement>('.vitrina__event')].map(
				(link) => link.dataset.vitrinaEvent ?? '',
			),
		),
	];
	const detailFor = (slug: string) =>
		section.querySelector<HTMLElement>(`.vitrina__detail-body[data-vitrina-for="${slug}"]`);
	const firstDemoOf = (eventSlug: string) =>
		section.querySelector<HTMLElement>(
			`.vitrina__detail-body[data-vitrina-event-of="${eventSlug}"]`,
		)?.dataset.vitrinaFor;

	let currentEvent = eventSlugs[0];
	let currentDemo = firstDemoOf(currentEvent) ?? '';
	let nudged = false;

	const showOnly = (selector: string, active: string) => {
		section.querySelectorAll<HTMLElement>(selector).forEach((element) => {
			element.hidden = element.dataset.vitrinaFor !== active;
		});
	};

	const updateCountdown = () => {
		const count = section.querySelector<HTMLElement>(
			`.mini[data-vitrina-for="${currentDemo}"] [data-countdown]`,
		);
		const days = count?.querySelector('[data-countdown-days]');
		if (count?.dataset.countdown && days) {
			days.textContent = String(daysUntil(count.dataset.countdown, new Date()));
		}
	};

	const updateHeaderCta = () => {
		const message = detailFor(currentDemo)?.dataset.headerMessage;
		if (!message) return;
		root.querySelectorAll<HTMLAnchorElement>('#home-header a.whatsapp-button').forEach(
			(link) => {
				// The visitor picked a demo: the header quote names it instead of the calendar quote.
				delete link.dataset.promoMessage;
				link.href = withWhatsAppText(link.href, message, window.location.href);
			},
		);
	};

	// One WhatsApp button serves every demo; it quotes the demo shown with `Ref. EVENT-STYLE-VITRINA`.
	const updateQuote = () => {
		const detail = detailFor(currentDemo);
		const quote = section.querySelector<HTMLAnchorElement>('a.vitrina__quote');
		const message = detail?.dataset.quoteMessage;
		if (!detail || !quote || !message) return;
		quote.href = withWhatsAppText(quote.href, message, window.location.href);
		quote.setAttribute(
			'aria-label',
			`Quiero una invitación como ${detail.dataset.quoteName} por WhatsApp`,
		);
		quote.dataset.eventType = detail.dataset.eventType;
		quote.dataset.eventLabel = detail.dataset.eventLabel;
	};

	const announce = () => {
		const detail = detailFor(currentDemo);
		const thumb = section.querySelector<HTMLImageElement>(
			`.vitrina__style[data-vitrina-demo="${currentDemo}"] img`,
		);
		if (!detail) return;
		root.dispatchEvent(
			new CustomEvent<VitrinaChangeDetail>(VITRINA_CHANGE_EVENT, {
				detail: {
					slug: currentDemo,
					label: detail.dataset.barLabel ?? '',
					barMessage: detail.dataset.barMessage ?? '',
					thumbSrc: thumb?.currentSrc || thumb?.src || '',
				},
			}),
		);
	};

	const render = () => {
		showOnly('.vitrina__eyebrow, .vitrina__styles-group', currentEvent);
		showOnly(
			'.vitrina__bar [data-vitrina-for], .mini, .vitrina__detail [data-vitrina-for]',
			currentDemo,
		);
		root.querySelectorAll<HTMLElement>('.hero-prime__chip, .vitrina__event').forEach((link) => {
			if (link.dataset.vitrinaEvent === currentEvent)
				link.setAttribute('aria-current', 'true');
			else link.removeAttribute('aria-current');
		});
		section.querySelectorAll<HTMLElement>('[data-vitrina-demo]').forEach((button) => {
			button.setAttribute('aria-pressed', String(button.dataset.vitrinaDemo === currentDemo));
		});
		updateCountdown();
		updateQuote();
		announce();
	};

	const select = (eventSlug: string, demoSlug?: string) => {
		if (!eventSlugs.includes(eventSlug)) return;
		currentEvent = eventSlug;
		const demoInEvent =
			demoSlug && detailFor(demoSlug)?.dataset.vitrinaEventOf === eventSlug
				? demoSlug
				: undefined;
		currentDemo = demoInEvent ?? firstDemoOf(eventSlug) ?? currentDemo;
		render();
	};

	const setDevice = (device: string) => {
		section.dataset.device = device;
		section.querySelectorAll<HTMLButtonElement>('[data-vitrina-device]').forEach((button) => {
			const active = button.dataset.vitrinaDevice === device;
			button.setAttribute('aria-pressed', String(active));
			if (active) {
				const hint = section.querySelector('[data-vitrina-hint]');
				if (hint) hint.textContent = button.dataset.hint ?? '';
			}
		});
	};

	// One gentle scroll inside the screen, so visitors see the invitation is live.
	const nudge = () => {
		if (nudged || prefersReducedMotion()) return;
		nudged = true;
		const mini = section.querySelector<HTMLElement>(`.mini[data-vitrina-for="${currentDemo}"]`);
		if (!mini) return;
		window.setTimeout(() => {
			mini.scrollTo({ top: mini.clientHeight * 0.55, behavior: 'smooth' });
			window.setTimeout(() => mini.scrollTo({ top: 0, behavior: 'smooth' }), 1300);
		}, 900);
	};

	root.addEventListener('click', (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const eventLink = target?.closest<HTMLAnchorElement>('a[data-vitrina-event]');
		if (eventLink) {
			const slug = eventLink.dataset.vitrinaEvent ?? '';
			if (!eventSlugs.includes(slug)) return;
			event.preventDefault();
			select(slug, eventLink.dataset.vitrinaPick);
			updateHeaderCta();
			try {
				history.replaceState(null, '', `#${slug}`);
			} catch {
				// Sandboxed frames may refuse history writes; the selection still applies.
			}
			section.scrollIntoView({
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
				block: 'start',
			});
			return;
		}
		const demoButton = target?.closest<HTMLElement>('[data-vitrina-demo]');
		if (demoButton && section.contains(demoButton)) {
			select(currentEvent, demoButton.dataset.vitrinaDemo);
			updateHeaderCta();
			return;
		}
		const deviceButton = target?.closest<HTMLElement>('[data-vitrina-device]');
		if (deviceButton && section.contains(deviceButton)) {
			setDevice(deviceButton.dataset.vitrinaDevice ?? 'phone');
		}
	});

	const fromHash = () => {
		const slug = eventFromHash(window.location.hash, eventSlugs);
		if (!slug) return false;
		select(slug);
		updateHeaderCta();
		return true;
	};
	window.addEventListener('hashchange', fromHash);

	if ('IntersectionObserver' in window) {
		const device = section.querySelector('.vitrina__device');
		if (device) {
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						nudge();
						observer.disconnect();
					}
				},
				{ threshold: 0.5 },
			);
			observer.observe(device);
		}
	}

	if (!fromHash()) render();
}
