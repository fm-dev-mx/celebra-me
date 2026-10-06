/**
 * Visual reference tooling marks the page before any script runs (`__celebraScreenshotMode`) so
 * JS-driven motion can settle to its final state. CSS motion is already handled by the capture
 * tooling, and this mode never changes styles or server-rendered markup.
 */
export function isVisualCaptureMode(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		document.documentElement.dataset.screenshot === 'audit' ||
		(window as Window & { __celebraScreenshotMode?: string }).__celebraScreenshotMode ===
			'audit'
	);
}
