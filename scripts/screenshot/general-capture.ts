// =============================================================================
// CELEBRA-ME | Screenshot Tool — General Page Screenshot Orchestration
// =============================================================================

import type { Page } from 'playwright';
import type { ScreenshotJob, CaptureResult } from './types.js';
import {
	type CaptureTask,
	type CapturePlanResult,
	buildTaskFailureResult,
	getPlannedCaptureLabel,
	plannedTasksFromCapturePlan,
	resolveCapturePlan,
	withTaskIdentity,
} from './capture-plan.js';
import { buildScreenshotUrl, navigateTo } from './navigation.js';
import {
	captureElement,
	captureFullPage,
	captureViewport,
	resetScrollAndAssertAboveFold,
} from './element-capture.js';
import { captureLandingStitchedFullPage } from './landing-capture.js';
import { buildScreenshotPath, getAboveFoldCriticalSelector } from './utils.js';

/**
 * Capture screenshots for a general page (landing, dashboard, login, custom).
 *
 * Output files:
 *   01-viewport
 *   02-full-page
 *   (03-header, 04-main, 05-footer for full QA)
 *   (06-section-{name} for full QA with sections)
 */
export async function captureGeneralPageScreenshots(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CapturePlanResult> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;

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

	const pageUrl = buildScreenshotUrl(job.url);
	await navigateTo(
		page,
		pageUrl,
		job.mode,
		job.animationHandling,
		job.criticalSelectors,
		job.hideSelectors,
	);

	const tasks = await resolveCapturePlan(page, job);
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

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		if (t.type === 'viewport') {
			try {
				await resetScrollAndAssertAboveFold(
					page,
					getAboveFoldCriticalSelector(job.pageType),
				);
				const result = await captureViewport(page, taskPath, format);
				record(t, result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} catch (err) {
				console.warn(`  ✕ Failed to capture viewport: ${err}`);
				recordFail(t, taskPath, String(err));
			}
		} else if (t.type === 'full-page') {
			try {
				const pageViewport = page.viewportSize();
				const isLanding = job.pageType === 'landing';
				const isDesktop = pageViewport ? pageViewport.width >= 1280 : false;
				const useStitch = isLanding && !isDesktop;

				const result = useStitch
					? await captureLandingStitchedFullPage(page, taskPath, format)
					: await captureFullPage(page, taskPath, format);
				record(t, result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} catch (err) {
				console.warn(`  ✕ Failed to capture full page: ${err}`);
				recordFail(t, taskPath, String(err));
			}
		} else {
			if (t.type === 'header') {
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.waitForTimeout(100);
			}

			const isSectionLike = t.type === 'section' || t.type === 'critical';
			const result = await captureElement(page, t.selector!, taskPath, format, {
				hideOverlays: t.type !== 'header',
				...(isSectionLike ? { sectionExtent: job.sectionExtent } : {}),
			});

			if (result) {
				record(t, result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} else {
				console.warn(`  ✕ Failed to capture element: ${t.id} (${t.selector})`);
				recordFail(t, taskPath, `Element "${t.selector}" could not be captured.`);
			}
		}
	}

	return { results, plannedCount, plannedTasks };
}
