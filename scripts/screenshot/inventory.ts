// =============================================================================
// CELEBRA-ME | Screenshot Tool — Section Inventory Service
// =============================================================================

import type { Page } from 'playwright';

export interface SectionInventoryItem {
	/** Stable section identity, e.g. "hero", "quote", "family" */
	id: string;
	/** Human-readable label for reporting */
	label: string;
	/** 1-based rendered order */
	order: number;
	/** Canonical CSS selector */
	selector: string;
	/** Document-relative bounding box */
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	/** Whether the section is visibly rendered with positive dimensions */
	isVisible: boolean;
}

export interface SectionInventoryReport {
	expected: number;
	rendered: number;
	sections: SectionInventoryItem[];
	duplicates: string[];
	missing: string[];
	topY: number;
	bottomY: number;
}

/**
 * Derive the canonical section inventory from the rendered DOM.
 *
 * Enforces:
 *  - Deduplication by stable section identity (`data-screenshot-section`)
 *  - Nested-marker exclusion (sub-elements inside a section root do not duplicate captures)
 *  - Filtering out hidden, zero-dimension, or operational overlay nodes
 *  - Ordering sections strictly by DOM position (topY)
 */
export async function deriveSectionInventory(page: Page): Promise<SectionInventoryReport> {
	const script = `
		(() => {
			const candidateElements = Array.from(
				document.querySelectorAll('[data-screenshot-section]')
			);

			// Filter out nested markers: if element B is inside element A and both have
			// [data-screenshot-section], keep only the top-level container element A.
			const topLevelElements = candidateElements.filter((el) => {
				let parent = el.parentElement;
				while (parent) {
					if (parent.hasAttribute('data-screenshot-section')) {
						return false;
					}
					parent = parent.parentElement;
				}
				return true;
			});

			const seenIds = new Set();
			const duplicates = [];
			const items = [];

			for (const el of topLevelElements) {
				const rawId = el.getAttribute('data-screenshot-section');
				if (!rawId) continue;

				const id = rawId.trim();
				if (seenIds.has(id)) {
					duplicates.push(id);
					continue; // Deduplicate repeated markers
				}
				seenIds.add(id);

				const style = window.getComputedStyle(el);
				const rect = el.getBoundingClientRect();
				const isVisible =
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					Number.parseFloat(style.opacity || '1') > 0.01 &&
					rect.width > 0 &&
					rect.height > 0;

				if (!isVisible) continue;

				const y = Math.floor(rect.top + window.scrollY);
				const height = Math.ceil(rect.height);
				const x = Math.floor(rect.left + window.scrollX);
				const width = Math.ceil(rect.width);

				// Format label nicely: "hero" -> "Hero", "personalized-access" -> "Personalized Access"
				const label = id
					.replace(/[-_]/g, ' ')
					.replace(/\\b\\w/g, (c) => c.toUpperCase());

				items.push({
					id,
					label,
					selector: '[data-screenshot-section="' + id + '"]',
					bounds: { x, y, width, height },
					isVisible,
				});
			}

			// Sort items strictly by top Y position
			items.sort((a, b) => a.bounds.y - b.bounds.y);

			// Assign 1-based order
			items.forEach((item, index) => {
				item.order = index + 1;
			});

			const topY = items.length > 0 ? items[0].bounds.y : 0;
			const bottomY = items.length > 0
				? Math.max(...items.map((i) => i.bounds.y + i.bounds.height))
				: 0;

			const expectedList = (() => {
				const container = document.getElementById('invitation-sections-container');
				if (container) {
					const attr = container.getAttribute('data-expected-sections');
					if (attr) {
						try {
							const parsed = JSON.parse(attr);
							if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
								return parsed;
							}
						} catch {}
					}
				}
				return Array.from(new Set(items.map((i) => i.id)));
			})();

			const renderedIds = new Set(items.map((i) => i.id));
			const missing = expectedList.filter((id) => !renderedIds.has(id));

			return {
				expected: expectedList.length,
				rendered: items.length,
				sections: items,
				duplicates: Array.from(new Set(duplicates)),
				missing,
				topY,
				bottomY,
			};
		})()
	`;

	try {
		const result = await page.evaluate(script);
		if (result && typeof result === 'object' && Array.isArray((result as SectionInventoryReport).sections)) {
			return result as SectionInventoryReport;
		}
		return {
			expected: 0,
			rendered: 0,
			sections: [],
			duplicates: [],
			missing: [],
			topY: 0,
			bottomY: 0,
		};
	} catch (err) {
		console.warn(`  ⚠ Failed to derive DOM section inventory: ${err}`);
		return {
			expected: 0,
			rendered: 0,
			sections: [],
			duplicates: [],
			missing: [],
			topY: 0,
			bottomY: 0,
		};
	}
}

export interface RevealCapabilities {
	hasReveal: boolean;
	revealType: 'envelope' | 'editorial-cover' | 'none';
	hasLetter: boolean;
	hasFlapTransition: boolean;
}

export async function detectRevealCapabilities(page: Page): Promise<RevealCapabilities> {
	try {
		const res = await page.evaluate(() => {
			const coverWrapper = document.querySelector(
				'ds-editorial-cover, .editorial-cover-root, [data-screenshot="editorial-cover"], [data-reveal-variant="editorial-cover"]',
			);
			if (coverWrapper) {
				return {
					hasReveal: true,
					revealType: 'editorial-cover' as const,
					hasLetter: false,
					hasFlapTransition: false,
				};
			}

			const envelopeWrapper = document.querySelector(
				'ds-envelope-reveal, .envelope-wrapper, [data-screenshot="reveal-section"]',
			);
			if (envelopeWrapper) {
				const letterEl = document.querySelector(
					'.envelope-card, [data-screenshot="reveal-letter"], .letter-preview',
				);
				const flapEl = document.querySelector(
					'.envelope-flap, [data-screenshot="reveal-flap"], [data-screenshot="reveal-trigger"], .seal-btn',
				);
				return {
					hasReveal: true,
					revealType: 'envelope' as const,
					hasLetter: Boolean(letterEl),
					hasFlapTransition: Boolean(flapEl),
				};
			}

			return {
				hasReveal: false,
				revealType: 'none' as const,
				hasLetter: false,
				hasFlapTransition: false,
			};
		});
		return (
			res ?? {
				hasReveal: false,
				revealType: 'none',
				hasLetter: false,
				hasFlapTransition: false,
			}
		);
	} catch {
		return {
			hasReveal: false,
			revealType: 'none',
			hasLetter: false,
			hasFlapTransition: false,
		};
	}
}
