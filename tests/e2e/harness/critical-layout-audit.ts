/** Browser-side geometry shared by public routes and synthetic variants. */
export function auditCriticalLayout(root: Element): string[] {
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
	return [...new Set(issues)];
}
