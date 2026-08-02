// =============================================================================
// CELEBRA-ME | Screenshot Tool — Capture Plan Resolution
// =============================================================================

import type { Page } from 'playwright';
import { type ScreenshotJob, type CaptureResult, KNOWN_SECTIONS } from './types.js';
import {
	deriveSectionInventory,
	detectRevealCapabilities,
	type RevealCapabilities,
} from './inventory.js';
import { getResolvedSectionIds } from './scope.js';

export type TaskRequirement = 'required' | 'optional' | 'unsupported';

export interface CaptureTask {
	id: string;
	label: string;
	type:
		| 'viewport'
		| 'full-page'
		| 'header'
		| 'main'
		| 'footer'
		| 'critical'
		| 'section'
		| 'invitation-step';
	selector?: string;
	fallbackSelectors?: string[];
	invitationStep?:
		'initial-full-page' | 'reveal-closed' | 'reveal-letter-open' | 'reveal-open' | 'full-open';
	requirement?: TaskRequirement;
	viewportOnly?: boolean;
}

export type PlannedCaptureTask = { id: string; required: boolean };

export interface CapturePlanResult {
	results: CaptureResult[];
	plannedCount: number;
	plannedTasks: PlannedCaptureTask[];
}

export interface ResolveCapturePlanOptions {
	/** When provided, skips a second detectRevealCapabilities call (E1). */
	revealCapabilities?: RevealCapabilities;
}

export function getPlannedCaptureLabel(id: string): string {
	return id.replace(/^\d+-/, '');
}

/** Required unless explicitly optional or unsupported. */
export function isCaptureTaskRequired(task: Pick<CaptureTask, 'requirement'>): boolean {
	return task.requirement !== 'optional' && task.requirement !== 'unsupported';
}

export function plannedTasksFromCapturePlan(tasks: CaptureTask[]): PlannedCaptureTask[] {
	return tasks.map((task) => ({
		id: task.id,
		required: isCaptureTaskRequired(task),
	}));
}

export function withTaskIdentity(
	result: CaptureResult,
	task: Pick<CaptureTask, 'id' | 'label' | 'requirement'>,
): CaptureResult {
	return {
		...result,
		id: task.id,
		label: result.label || task.label,
		isOptional: task.requirement === 'optional',
	};
}

export function buildTaskFailureResult(
	task: Pick<CaptureTask, 'id' | 'label' | 'requirement'>,
	outputPath: string,
	viewportName: string,
	error: string,
): CaptureResult {
	return {
		id: task.id,
		path: outputPath,
		viewportName,
		label: task.label,
		success: false,
		error,
		isOptional: task.requirement === 'optional',
	};
}

/**
 * Batch-probe CSS selectors in one browser round-trip (E5).
 * For each probe, returns the first matching selector in order, or null.
 */
export async function probeFirstMatchingSelectors(
	page: Page,
	probes: Array<{ id: string; selectors: string[] }>,
): Promise<Record<string, string | null>> {
	if (probes.length === 0) return {};
	return page.evaluate((items) => {
		const out: Record<string, string | null> = {};
		for (const item of items) {
			out[item.id] = null;
			for (const sel of item.selectors) {
				try {
					if (document.querySelector(sel)) {
						out[item.id] = sel;
						break;
					}
				} catch {
					// Invalid selector — treat as non-match.
				}
			}
		}
		return out;
	}, probes);
}

async function appendKnownInvitationSections(page: Page, tasks: CaptureTask[]): Promise<void> {
	const sections = KNOWN_SECTIONS.filter((s) => s.pageType === 'invitation');
	const matches = await probeFirstMatchingSelectors(
		page,
		sections.map((s) => ({ id: s.id, selectors: [s.selector] })),
	);
	let sIndex = 1;
	for (const s of sections) {
		if (!matches[s.id]) continue;
		const orderStr = String(sIndex).padStart(2, '0');
		tasks.push({
			id: `10-${orderStr}-${s.outputSlug}`,
			label: `Section: ${s.label}`,
			type: 'section',
			selector: s.selector,
			requirement: 'required',
		});
		sIndex++;
	}
}

/**
 * Resolve only the section IDs supplied by the canonical scope plan.
 * A missing selector is kept as a required task so the run reports the
 * planned failure instead of silently shrinking the requested scope.
 */
async function appendResolvedSections(
	page: Page,
	tasks: CaptureTask[],
	job: ScreenshotJob,
): Promise<void> {
	const ids = getResolvedSectionIds(job);
	const sections = ids
		.map((id) =>
			KNOWN_SECTIONS.find(
				(section) => section.pageType === job.pageType && section.id === id,
			),
		)
		.filter((section): section is (typeof KNOWN_SECTIONS)[number] => Boolean(section));
	const matches = await probeFirstMatchingSelectors(
		page,
		sections.map((section) => ({
			id: section.id,
			selectors: [section.selector, ...(section.fallbackSelectors ?? [])],
		})),
	);
	for (const section of sections) {
		tasks.push({
			id: `06-section-${section.outputSlug}`,
			label: `Section: ${section.label}`,
			type: 'section',
			selector: matches[section.id] ?? section.selector,
			requirement: 'required',
		});
	}
}

async function appendInventoryOrKnownInvitationSections(
	page: Page,
	tasks: CaptureTask[],
): Promise<void> {
	const inventory = await deriveSectionInventory(page);
	if (inventory.sections.length > 0) {
		for (const sec of inventory.sections) {
			const orderStr = String(sec.order).padStart(2, '0');
			tasks.push({
				id: `10-${orderStr}-${sec.id}`,
				label: `Section: ${sec.label}`,
				type: 'section',
				selector: sec.selector,
				requirement: 'required',
			});
		}
		return;
	}
	await appendKnownInvitationSections(page, tasks);
}

async function resolveSingleSectionTask(
	page: Page,
	job: ScreenshotJob,
): Promise<CaptureTask | null> {
	const s = KNOWN_SECTIONS.find(
		(x) =>
			x.pageType === job.pageType &&
			x.id === (job.selectedSection ?? job.selectedSections?.[0]),
	);
	if (!s) return null;
	const selectors = [s.selector, ...(s.fallbackSelectors ?? [])];
	const matches = await probeFirstMatchingSelectors(page, [{ id: s.id, selectors }]);
	const selector = matches[s.id] ?? s.selector;
	return {
		id: '06-section-' + s.outputSlug,
		label: `Section: ${s.label}`,
		type: 'section',
		selector,
	};
}

// eslint-disable-next-line complexity
export async function resolveCapturePlan(
	page: Page,
	job: ScreenshotJob,
	options: ResolveCapturePlanOptions = {},
): Promise<CaptureTask[]> {
	const tasks: CaptureTask[] = [];

	if (job.pageType === 'invitation') {
		const capabilities = options.revealCapabilities ?? (await detectRevealCapabilities(page));

		const fullOpenTask: CaptureTask = {
			id: '05-invitation-full-page',
			label: 'Full invitation (open)',
			type: 'invitation-step',
			invitationStep: 'full-open',
			requirement: 'required',
		};
		const shouldCaptureFullOpen =
			job.revealHandling !== 'closed-only' &&
			job.revealHandling !== 'skip' &&
			(job.target === 'full-page' || capabilities.hasReveal);

		const initialClosedTask: CaptureTask = {
			id: '01-initial-closed-viewport',
			label:
				capabilities.revealType === 'editorial-cover'
					? 'Initial cover (closed)'
					: 'Initial envelope (closed)',
			type: 'invitation-step',
			invitationStep: 'initial-full-page',
			requirement: 'required',
			viewportOnly: true,
		};

		if (job.target === 'full-page') {
			tasks.push(initialClosedTask);
			if (shouldCaptureFullOpen) {
				tasks.push(fullOpenTask);
			}
		} else if (job.target === 'critical-qa') {
			tasks.push(initialClosedTask);
			if (job.revealHandling !== 'open-only' && capabilities.hasReveal) {
				tasks.push({
					id: '02-reveal-closed',
					label:
						capabilities.revealType === 'editorial-cover'
							? 'Reveal cover (closed)'
							: 'Reveal section (closed)',
					type: 'invitation-step',
					invitationStep: 'reveal-closed',
					requirement: 'optional',
				});
			}
			if (shouldCaptureFullOpen) {
				if (capabilities.hasLetter) {
					tasks.push({
						id: '03-reveal-letter-open',
						label: 'Reveal letter (open)',
						type: 'invitation-step',
						invitationStep: 'reveal-letter-open',
						requirement: 'optional',
					});
				}
				if (capabilities.hasFlapTransition) {
					tasks.push({
						id: '04-reveal-transition-open',
						label: 'Reveal transition (open)',
						type: 'invitation-step',
						invitationStep: 'reveal-open',
						requirement: 'optional',
					});
				}
			}

			// Explicit section IDs are the only persisted section scope. Named
			// presets retain their documented runtime inventory behavior.
			if (job.scope?.invitations[0].sectionSelection.kind === 'ids') {
				await appendResolvedSections(page, tasks, job);
			} else {
				await appendInventoryOrKnownInvitationSections(page, tasks);
			}

			if (shouldCaptureFullOpen) {
				tasks.push(fullOpenTask);
			}
		} else if (job.target === 'all-sections') {
			if (job.scope?.invitations[0].sectionSelection.kind === 'ids') {
				await appendResolvedSections(page, tasks, job);
			} else {
				await appendInventoryOrKnownInvitationSections(page, tasks);
			}
		} else if (job.target === 'single-section' && job.selectedSection) {
			for (const selectedSection of job.selectedSections ?? [job.selectedSection]) {
				const task = await resolveSingleSectionTask(page, {
					...job,
					selectedSection,
				});
				if (task) tasks.push(task);
			}
		} else if (job.target === 'reveal-only') {
			tasks.push({
				id: '02-reveal-closed',
				label:
					capabilities.revealType === 'editorial-cover'
						? 'Reveal cover (closed)'
						: 'Reveal section (closed)',
				type: 'invitation-step',
				invitationStep: 'reveal-closed',
				requirement: 'required',
			});
			tasks.push({
				id: '03-reveal-letter-open',
				label: 'Reveal letter (open)',
				type: 'invitation-step',
				invitationStep: 'reveal-letter-open',
				requirement: 'optional',
			});
			tasks.push({
				id: '04-reveal-transition-open',
				label: 'Reveal transition (open)',
				type: 'invitation-step',
				invitationStep: 'reveal-open',
				requirement: 'optional',
			});
		}
	} else {
		// General Page type
		if (job.includeLayout) {
			tasks.push({ id: '01-viewport', label: 'Viewport', type: 'viewport' });
		}

		if (job.target === 'full-page' || job.target === 'critical-qa') {
			tasks.push({ id: '02-full-page', label: 'Full page', type: 'full-page' });
		}

		if (job.target === 'critical-qa') {
			if (job.includeLayout) {
				const layoutMatches = await probeFirstMatchingSelectors(page, [
					{ id: 'header', selectors: ['.header-base, header, .header'] },
					{
						id: 'main',
						selectors: ['[data-screenshot="main"], main, .main-content'],
					},
					{
						id: 'footer',
						selectors: ['[data-screenshot="footer"], footer, .footer'],
					},
				]);

				if (layoutMatches.header) {
					await page.evaluate(() => window.scrollTo(0, 0));
					await page.waitForTimeout(50);
					const isHeaderVisible = await page
						.locator('.header-base, header, .header')
						.first()
						.isVisible();
					if (isHeaderVisible) {
						tasks.push({
							id: '03-header',
							label: 'Header',
							type: 'header',
							selector: '.header-base, header, .header',
						});
					} else {
						console.log('  ℹ Header is hidden — skipping header capture.');
					}
				}

				if (layoutMatches.main) {
					tasks.push({
						id: '04-main',
						label: 'Main',
						type: 'main',
						selector: '[data-screenshot="main"], main, .main-content',
					});
				}

				if (layoutMatches.footer) {
					tasks.push({
						id: '05-footer',
						label: 'Footer',
						type: 'footer',
						selector: '[data-screenshot="footer"], footer, .footer',
					});
				}
			}

			// Predefined critical sections
			if (job.mode === 'audit') {
				const critical = job.criticalSelectors.filter((s) => s.capture);
				const criticalMatches = await probeFirstMatchingSelectors(
					page,
					critical.map((c, index) => ({
						id: `critical-${index}`,
						selectors: [c.selector],
					})),
				);
				let cIndex = 20;
				critical.forEach((c, index) => {
					const exists = Boolean(criticalMatches[`critical-${index}`]);
					if (exists || c.required) {
						tasks.push({
							id: `${cIndex}-critical-${c.label || 'elem'}`,
							label: `Critical: ${c.label || c.selector}`,
							type: 'critical',
							selector: c.selector,
						});
						cIndex++;
					}
				});
			}
		} else if (job.target === 'all-sections') {
			const sections = KNOWN_SECTIONS.filter((s) => s.pageType === job.pageType);
			const matches = await probeFirstMatchingSelectors(
				page,
				sections.map((s) => ({
					id: s.id,
					selectors: [s.selector, ...(s.fallbackSelectors ?? [])],
				})),
			);
			let sIndex = 6;
			for (const s of sections) {
				const selector = matches[s.id];
				if (!selector) continue;
				tasks.push({
					id: `${String(sIndex).padStart(2, '0')}-section-${s.outputSlug}`,
					label: `Section: ${s.label}`,
					type: 'section',
					selector,
				});
				sIndex++;
			}
		} else if (
			job.target === 'single-section' &&
			(job.selectedSection || job.selectedSections?.length)
		) {
			for (const selectedSection of job.selectedSections ?? [job.selectedSection!]) {
				const task = await resolveSingleSectionTask(page, { ...job, selectedSection });
				if (task) tasks.push(task);
			}
		}
	}

	return tasks;
}
