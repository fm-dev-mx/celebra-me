/**
 * @jest-environment jsdom
 */
import { isVisualCaptureMode } from '@/lib/invitation/visual-capture-mode';

describe('visual capture mode', () => {
	afterEach(() => {
		delete (window as Window & { __celebraScreenshotMode?: string }).__celebraScreenshotMode;
		delete document.documentElement.dataset.screenshot;
	});

	it('is off for real visitors', () => {
		expect(isVisualCaptureMode()).toBe(false);
	});

	it('follows the capture harness marker or the audit document flag', () => {
		(window as Window & { __celebraScreenshotMode?: string }).__celebraScreenshotMode = 'audit';
		expect(isVisualCaptureMode()).toBe(true);
		delete (window as Window & { __celebraScreenshotMode?: string }).__celebraScreenshotMode;
		document.documentElement.dataset.screenshot = 'audit';
		expect(isVisualCaptureMode()).toBe(true);
	});
});
