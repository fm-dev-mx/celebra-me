// =============================================================================
// CELEBRA-ME | Screenshot Tool — Invitation Screenshot Orchestration
// =============================================================================

import type { Page } from 'playwright';
import {
	type ScreenshotJob,
	type CaptureResult,
	type OutputFormat,
	type SectionExtent,
} from './types.js';
import { detectRevealCapabilities } from './inventory.js';
import {
	type CaptureTask,
	type CapturePlanResult,
	buildTaskFailureResult,
	getPlannedCaptureLabel,
	plannedTasksFromCapturePlan,
	resolveCapturePlan,
	assertCapturePlanScopeOwnership,
	withTaskIdentity,
} from './capture-plan.js';
import { buildScreenshotUrl, navigateTo } from './navigation.js';
import {
	createRevealOcclusionCache,
	ensureInvitationOpenForCapture,
	findRevealLetter,
	findRevealSection,
	shouldSkipInvitationOpenCapture,
	waitForRevealLetterLaidOut,
	waitForRevealSectionLaidOut,
} from './reveal.js';
import { captureElement, captureFullPage, captureViewport } from './element-capture.js';
import { captureInvitationOpen, validateDistinctReveal } from './invitation-full-page.js';
import { buildScreenshotPath, invalidateStaleInvitationFullPage } from './utils.js';

/**
 * Navigate, detect, and capture invitation screenshots for one viewport.
 *
 * Output files (when found):
 *   01-initial-closed-viewport
 *   02-reveal-closed
 *   03-reveal-letter-open
 *   04-reveal-transition-open
 *   05-invitation-full-page
 *   (10-*-{section} for full QA; captured before 05 when present)
 */
// eslint-disable-next-line complexity -- Invitation capture sequence branches by planned step type.
export async function captureInvitationScreenshots(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CapturePlanResult> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;
	const plannedInvitation =
		job.scope?.invitations.find((invitation) => invitation.url === job.url) ??
		job.scope?.invitations[0];
	const expectedInvitation = plannedInvitation
		? { routeIdentity: plannedInvitation.routeIdentity, slug: plannedInvitation.slug }
		: undefined;
	const timings: Array<{ phase: string; ms: number }> = [];
	const mark = (phase: string) => {
		const elapsed = Date.now();
		return () => {
			timings.push({ phase, ms: Date.now() - elapsed });
		};
	};

	const record = (task: CaptureTask, result: CaptureResult) => {
		results.push(
			withTaskIdentity(
				{
					...result,
					viewportName,
					label: result.label || task.label,
				},
				task,
			),
		);
	};
	const recordFail = (task: CaptureTask, taskPath: string, error: string) => {
		results.push(buildTaskFailureResult(task, taskPath, viewportName, error));
	};

	let revealOpened = false;
	const occlusionCache = createRevealOcclusionCache();

	const ensureClosedState = async () => {
		const t = mark('ensureClosedState');
		occlusionCache.invalidate();
		const closedUrl = buildScreenshotUrl(job.url, 'closed');
		await navigateTo(
			page,
			closedUrl,
			job.mode,
			job.animationHandling,
			job.criticalSelectors,
			job.hideSelectors,
			expectedInvitation,
			job.waitSelectors,
		);
		t();
	};

	await ensureClosedState();

	const revealCapabilities = await detectRevealCapabilities(page);
	if (!revealCapabilities.hasReveal) {
		revealOpened = true;
	}

	// E1: reuse capabilities already detected for this viewport.
	const tasks = await resolveCapturePlan(page, job, { revealCapabilities });
	assertCapturePlanScopeOwnership(tasks, job);
	const plannedTasks = plannedTasksFromCapturePlan(tasks);
	const plannedCount = plannedTasks.filter((t) => t.required).length;

	console.log('  Planned captures:');
	for (const t of tasks) {
		const optionalTag = t.requirement === 'optional' ? ' (optional)' : '';
		console.log(`    - ${viewportName} / ${getPlannedCaptureLabel(t.id)}${optionalTag}`);
	}
	console.log(
		`  Required planned: ${plannedCount}; total planned: ${tasks.length} (optional: ${tasks.length - plannedCount})`,
	);

	const ensureOpenState = async (): Promise<boolean> => {
		if (revealOpened) return true;
		const t = mark('open reveal');
		revealOpened = await ensureInvitationOpenForCapture(page, job, {
			hasReveal: revealCapabilities.hasReveal,
			maxAttempts: 2,
			occlusionCache,
			expectedInvitation,
		});
		t();
		return revealOpened;
	};

	/** Navigate to ?reveal=letter once per viewport; 03 and 04 reuse the same page. */
	let letterHeldReady: boolean | null = null;
	const ensureLetterState = async (): Promise<boolean> => {
		if (letterHeldReady !== null) return letterHeldReady;
		const t = mark('ensureLetterState');
		occlusionCache.invalidate();
		const letterUrl = buildScreenshotUrl(job.url, 'letter');
		await navigateTo(
			page,
			letterUrl,
			job.mode,
			job.animationHandling,
			job.criticalSelectors,
			job.hideSelectors,
			expectedInvitation,
			job.waitSelectors,
		);
		const letterCount = await page.locator('[data-screenshot="reveal-letter"]').count();
		const ready =
			letterCount > 0
				? await waitForRevealLetterLaidOut(page)
				: await waitForRevealSectionLaidOut(page);
		if (!ready) {
			console.warn(
				letterCount > 0
					? '  ⚠ reveal=letter letter not laid out (server ?reveal=letter contract)'
					: '  ⚠ reveal=letter section not laid out (no reveal-letter hook)',
			);
		}
		letterHeldReady = ready;
		t();
		return ready;
	};

	let sectionOpenFailedLogged = false;

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		const tMark = mark(getPlannedCaptureLabel(t.id));

		if (t.type === 'invitation-step') {
			if (t.invitationStep === 'initial-full-page') {
				try {
					const result = t.viewportOnly
						? await captureViewport(page, taskPath, format)
						: await captureFullPage(page, taskPath, format);
					record(t, result);
					console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
				} catch (err) {
					recordFail(t, taskPath, String(err));
				}
			} else if (t.invitationStep === 'reveal-closed') {
				await ensureClosedState();
				const revealSelector = await findRevealSection(page);
				let captured = false;
				if (revealSelector) {
					const result = await captureElement(page, revealSelector, taskPath, format);
					if (result) {
						record(t, result);
						console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
						captured = true;
					}
				}
				if (!captured) {
					recordFail(
						t,
						taskPath,
						'Reveal closed element not found or could not be captured.',
					);
				}
			} else if (t.invitationStep === 'reveal-letter-open') {
				const letterReady = await ensureLetterState();
				let captured = false;
				if (letterReady) {
					const letterSelector = await findRevealLetter(page);
					if (letterSelector) {
						const result = await captureElement(
							page,
							letterSelector,
							taskPath,
							format,
							{
								sectionExtent: 'viewport',
							},
						);
						if (result) {
							record(t, result);
							console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
							captured = true;
						}
					} else {
						const revealSelector = await findRevealSection(page);
						if (revealSelector) {
							const result = await captureElement(
								page,
								revealSelector,
								taskPath,
								format,
								{
									sectionExtent: 'viewport',
								},
							);
							if (result) {
								record(t, result);
								console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
								captured = true;
							}
						}
					}
				}
				if (!captured) {
					recordFail(
						t,
						taskPath,
						'Reveal letter element not found or could not be captured.',
					);
				}
			} else if (t.invitationStep === 'reveal-open') {
				const letterReady = await ensureLetterState();
				let captured = false;
				if (letterReady) {
					const revealSelector = await findRevealSection(page);
					if (revealSelector) {
						const result = await captureElement(page, revealSelector, taskPath, format);
						if (result) {
							record(t, result);
							console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
							captured = true;
						}
					}
				}
				if (!captured) {
					recordFail(
						t,
						taskPath,
						'Reveal section open element not found or could not be captured.',
					);
				}
			} else if (t.invitationStep === 'full-open') {
				const isOpen = await ensureOpenState();
				if (shouldSkipInvitationOpenCapture(isOpen, revealCapabilities.hasReveal)) {
					console.warn(
						'  ⚠ Reveal did not open; skipping 05-invitation-full-page for this viewport',
					);
					const removed = await invalidateStaleInvitationFullPage(taskPath);
					if (removed) {
						console.warn(
							`  ⚠ Removed stale 05-invitation-full-page for ${viewportName} so a previous run cannot be mistaken for a fresh capture.`,
						);
					}
					recordFail(t, taskPath, 'Reveal did not open; skipping full-page capture.');
				} else if (revealCapabilities.hasReveal && !(await occlusionCache.assert(page))) {
					console.warn(
						'  ⚠ Reveal still occludes invitation; skipping 05-invitation-full-page',
					);
					recordFail(
						t,
						taskPath,
						'Reveal still occludes invitation; skipping full-page capture.',
					);
				} else {
					const fullOpenResult = await captureInvitationOpen(
						page,
						outputDir,
						viewportName,
						format,
						job.sectionExtent === 'full' ? results : [],
					);
					if (fullOpenResult.length > 0) {
						for (const r of fullOpenResult) {
							record(t, r);
						}
					} else {
						recordFail(
							t,
							taskPath,
							'Full open invitation target not found or could not be captured.',
						);
					}
				}
			}
		} else if (t.type === 'section' || t.type === 'critical') {
			const isOpen = await ensureOpenState();
			if (shouldSkipInvitationOpenCapture(isOpen, revealCapabilities.hasReveal)) {
				if (!sectionOpenFailedLogged) {
					console.warn(
						'  ⚠ Reveal did not open; skipping section captures for this viewport',
					);
					sectionOpenFailedLogged = true;
				}
				recordFail(t, taskPath, 'Reveal did not open; skipping section captures.');
			} else if (revealCapabilities.hasReveal && !(await occlusionCache.assert(page))) {
				if (!sectionOpenFailedLogged) {
					console.warn('  ⚠ Reveal still occludes invitation; skipping section captures');
					sectionOpenFailedLogged = true;
				}
				recordFail(
					t,
					taskPath,
					'Reveal still occludes invitation; skipping section captures.',
				);
			} else {
				const captured = await captureSectionElement(
					page,
					t,
					taskPath,
					viewportName,
					format,
					job.sectionExtent,
				);
				if (captured) {
					record(t, captured);
					console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
				} else {
					const isVisible = await page
						.locator(t.selector!)
						.first()
						.isVisible()
						.catch(() => false);
					const failMsg = isVisible
						? `Element "${t.selector}" could not be captured.`
						: 'Element is hidden — skipped.';
					console.log(`  ℹ ${t.id} — ${isVisible ? 'failed' : 'hidden'}`);
					recordFail(t, taskPath, failMsg);
				}
			}
		}
		tMark();
	}

	await validateDistinctReveal(results);

	async function captureSectionElement(
		page: Page,
		task: CaptureTask,
		outputPath: string,
		viewportName: string,
		format: OutputFormat,
		sectionExtent: SectionExtent,
	): Promise<CaptureResult | null> {
		const isVisible = await page
			.locator(task.selector!)
			.first()
			.isVisible()
			.catch(() => false);
		if (!isVisible) return null;

		const result = await captureElement(page, task.selector!, outputPath, format, {
			sectionExtent,
		});
		if (!result) return null;

		result.viewportName = viewportName;
		result.label = task.label;
		return result;
	}

	if (timings.length > 0) {
		console.log('  ⏱ Timing:');
		for (const t of timings) {
			console.log(`    ${t.phase}: ${(t.ms / 1000).toFixed(1)}s`);
		}
	}

	return { results, plannedCount, plannedTasks };
}
