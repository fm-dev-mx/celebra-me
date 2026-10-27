import type { Page } from '@playwright/test';

/** Only use a response emitted by the target island's mount effect as the readiness signal. */
export async function gotoAfterIslandEffect(
	page: Pick<Page, 'goto' | 'waitForResponse'>,
	url: string,
	responseUrl: string,
): Promise<void> {
	// Register before navigation and observe both failures, including an early navigation failure.
	await Promise.all([
		page.waitForResponse(responseUrl),
		page.goto(url, { waitUntil: 'domcontentloaded' }),
	]);
}
