/**
 * Critical text beyond the hero title: hero names across hero variants, countdown numerals and
 * section titles. Curated here (rather than a component data attribute) so the audit does not
 * depend on every section component opting in.
 */
export const CRITICAL_TEXT_SELECTORS: readonly string[] = Object.freeze([
	'.invitation-hero__title',
	'.ceremonial-portrait-hero__name',
	'.framed-portrait-hero__name',
	'.editorial-cover__headline',
	'.countdown__value',
	'.countdown-title',
	'.family__title',
	'.gallery-section__title',
	'.gifts-section__title',
	'.itinerary__title',
	'.rsvp__title',
	'.event-location__heading',
	'.event-location__indications-heading',
	'.access-card__title',
]);

export interface CriticalLayoutAuditOptions {
	/**
	 * Opt-in: also audit these selectors for viewport overflow, ancestor clipping and text that
	 * spills out of its own box. Pass `CRITICAL_TEXT_SELECTORS`. Omitted, only the hero checks run.
	 * Must be passed as the `evaluate` argument: this function is serialized into the page.
	 */
	criticalTextSelectors?: readonly string[];
}

/** Browser-side geometry shared by public routes and synthetic variants. */
export function auditCriticalLayout(root: Element, options?: CriticalLayoutAuditOptions): string[] {
	const issues: string[] = [];
	const visible = (element: Element): boolean => {
		for (let node: Element | null = element; node; node = node.parentElement) {
			const style = getComputedStyle(node);
			if (
				style.display === 'none' ||
				style.visibility === 'hidden' ||
				Number(style.opacity) === 0
			)
				return false;
		}
		return element.getClientRects().length > 0;
	};
	const textRects = (element: Element): DOMRect[] => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const rects: DOMRect[] = [];
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!node.textContent?.trim()) continue;
			const range = document.createRange();
			range.selectNodeContents(node);
			rects.push(...Array.from(range.getClientRects()));
		}
		return rects;
	};
	const intersects = (a: DOMRect, b: DOMRect): boolean =>
		Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
		Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
	for (const title of root.querySelectorAll('.invitation-hero__title')) {
		if (!visible(title)) continue;
		const container = title.closest('.invitation-hero__title-wrapper') ?? title.parentElement!;
		const box = container.getBoundingClientRect();
		const rects = textRects(title);
		if (
			rects.some(
				(rect) =>
					rect.left < Math.max(0, box.left) - 2 ||
					rect.right > Math.min(document.documentElement.clientWidth, box.right) + 2,
			)
		)
			issues.push('Critical name exceeds its content area');
		for (
			let ancestor = title.parentElement;
			ancestor && ancestor !== document.body;
			ancestor = ancestor.parentElement
		) {
			const style = getComputedStyle(ancestor),
				bounds = ancestor.getBoundingClientRect();
			if (
				rects.some(
					(rect) =>
						(/hidden|clip/.test(style.overflowX) &&
							(rect.left < bounds.left - 2 || rect.right > bounds.right + 2)) ||
						(/hidden|clip/.test(style.overflowY) &&
							(rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2)),
				)
			)
				issues.push('Critical name clipped by ancestor');
		}
		const details = title
			.closest('.invitation-hero')
			?.querySelector('.invitation-hero__details');
		if (
			details &&
			// Range metrics include empty ascender/descender space: require a flow-box collision too.
			visible(details) &&
			intersects(title.getBoundingClientRect(), details.getBoundingClientRect()) &&
			rects.some((rect) => intersects(rect, details.getBoundingClientRect()))
		)
			issues.push('Title/details overlap');
	}
	for (const cue of root.querySelectorAll('.invitation-hero__scroll-indicator')) {
		if (!visible(cue)) continue;
		for (const content of root.querySelectorAll(
			'.invitation-hero__title, .invitation-hero__details, .invitation-hero__credits',
		)) {
			if (
				visible(content) &&
				textRects(content).some((rect) => intersects(rect, cue.getBoundingClientRect()))
			)
				issues.push('Scroll cue overlaps ' + content.className);
		}
	}
	const prompt = document.querySelector('.music-player__prompt');
	if (prompt && visible(prompt)) {
		const box = prompt.getBoundingClientRect();
		for (const content of root.querySelectorAll(
			'.invitation-hero__credits, .invitation-hero__scroll-indicator, .invitation-hero__title, .invitation-hero__details',
		)) {
			if (visible(content) && intersects(box, content.getBoundingClientRect()))
				issues.push('Music prompt overlaps ' + content.className);
		}
	}
	// Nested so the function stays self-contained when serialized into the page.
	const auditCriticalText = (selector: string, element: Element): void => {
		if (!visible(element) || element.closest('[aria-hidden="true"], .sr-only')) return;
		const own = element.getBoundingClientRect();
		// Screen-reader-only copies are 1px boxes by design; they are not rendered text.
		if (own.width <= 1 || own.height <= 1) return;
		const rects = textRects(element);
		if (rects.length === 0) return;
		// Range rects span the font's full content area (ascender to descender), which exceeds a
		// tight line box (e.g. `line-height: 1` countdown numerals in a 1em `overflow: hidden`
		// wrapper) without any visible glyph being cut. Vertical clipping is therefore measured
		// on the line box: trim the negative half-leading from each rect before comparing.
		const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
		const halfLeadingOvershoot = (rect: DOMRect): number =>
			Number.isFinite(lineHeight) ? Math.max(0, (rect.height - lineHeight) / 2) : 0;
		const viewportWidth = document.documentElement.clientWidth;
		if (rects.some((rect) => rect.left < -2 || rect.right > viewportWidth + 2))
			issues.push(`Critical text ${selector} exceeds the viewport`);
		if (rects.some((rect) => rect.left < own.left - 2 || rect.right > own.right + 2))
			issues.push(`Critical text ${selector} overflows its own box`);
		for (
			let ancestor: Element | null = element;
			ancestor && ancestor !== document.body;
			ancestor = ancestor.parentElement
		) {
			const style = getComputedStyle(ancestor),
				bounds = ancestor.getBoundingClientRect();
			const clipsX = /hidden|clip/.test(style.overflowX);
			const clipsY = /hidden|clip/.test(style.overflowY);
			const clipped = rects.some(
				(rect) =>
					(clipsX && (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)) ||
					(clipsY &&
						(rect.top + halfLeadingOvershoot(rect) < bounds.top - 2 ||
							rect.bottom - halfLeadingOvershoot(rect) > bounds.bottom + 2)),
			);
			if (clipped) {
				issues.push(`Critical text ${selector} clipped by ancestor`);
				return;
			}
		}
	};
	for (const selector of options?.criticalTextSelectors ?? [])
		for (const element of root.querySelectorAll(selector)) auditCriticalText(selector, element);
	return [...new Set(issues)];
}
