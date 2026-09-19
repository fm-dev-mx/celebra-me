jest.mock('../../../scripts/screenshot/navigation', () => ({
	buildScreenshotUrl: (url: string) => url,
	navigateTo: jest.fn(),
}));
jest.mock('../../../scripts/screenshot/element-capture', () => ({
	captureFullPage: jest.fn(),
}));
jest.mock('../../../scripts/screenshot/capture-plan', () => ({
	...jest.requireActual('../../../scripts/screenshot/capture-plan'),
	resolveCapturePlan: jest.fn(),
}));
jest.mock('../../../scripts/screenshot/utils', () => ({
	...jest.requireActual('../../../scripts/screenshot/utils'),
	buildScreenshotPath: jest.fn().mockResolvedValue('capture/mobile/02-full-page.png'),
}));

import { captureGeneralPageScreenshots } from '../../../scripts/screenshot/general-capture';
import { captureFullPage } from '../../../scripts/screenshot/element-capture';
import { resolveCapturePlan } from '../../../scripts/screenshot/capture-plan';
import type { ScreenshotJob } from '../../../scripts/screenshot/types';
import type { Page } from 'playwright';

describe('general full-page capture identity', () => {
	const job = {
		pageType: 'custom',
		url: 'http://localhost/custom',
		outputFormat: 'png',
		target: 'full-page',
	} as ScreenshotJob;
	const page = { viewportSize: () => ({ width: 390, height: 844 }) } as Page;

	beforeEach(() => {
		jest.mocked(resolveCapturePlan).mockResolvedValue([
			{ id: '02-full-page', label: 'Full page', type: 'full-page', requirement: 'required' },
		]);
	});

	it('uses the planned label instead of the filename and preserves artifact metadata', async () => {
		jest.mocked(captureFullPage).mockResolvedValue({
			path: 'capture/mobile/02-full-page.png',
			viewportName: '',
			label: '02-full-page',
			success: true,
			hash: 'artifact-hash',
		});
		const capture = await captureGeneralPageScreenshots(page, job, 'capture', 'mobile');
		expect(capture.results).toEqual([
			{
				id: '02-full-page',
				path: 'capture/mobile/02-full-page.png',
				viewportName: 'mobile',
				label: 'Full page',
				success: true,
				isOptional: false,
				hash: 'artifact-hash',
			},
		]);
	});

	it('keeps failed captures failed with their original error', async () => {
		jest.mocked(captureFullPage).mockRejectedValue(new Error('Screenshot failed'));
		const capture = await captureGeneralPageScreenshots(page, job, 'capture', 'mobile');
		expect(capture.results[0]).toMatchObject({
			id: '02-full-page',
			label: 'Full page',
			success: false,
			error: 'Error: Screenshot failed',
		});
	});
});
