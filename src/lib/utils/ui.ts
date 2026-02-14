/**
 * Shared UI utilities for digital invitations.
 */

/**
 * Detects if the current device is running iOS.
 */
export function isIOS(): boolean {
	if (typeof window === 'undefined') return false;
	const ua = navigator.userAgent;
	return (
		/iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && (navigator as any).maxTouchPoints > 1)
	);
}

/**
 * Copies a string to the clipboard with visual feedback for the trigger button.
 */
export async function copyToClipboard(text: string, button: HTMLElement): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);

		// Visual feedback
		const originalContent = button.innerHTML;
		button.innerHTML = '<span class="copy-success">✓</span>';
		button.classList.add('copy-success');

		setTimeout(() => {
			button.innerHTML = originalContent;
			button.classList.remove('copy-success');
		}, 2000);
	} catch (err) {
		console.error('Failed to copy text: ', err);
	}
}

/**
 * Initialize "Copy to Clipboard" behavior for a set of buttons.
 * @param selector CSS selector for the buttons.
 * @param dataAttr Attribute name containing the text to copy (default: 'data-address').
 */
export function initCopyButtons(
	selector: string = '.copy-button',
	dataAttr: string = 'data-address',
) {
	const copyButtons = document.querySelectorAll(selector);
	copyButtons.forEach((button) => {
		button.addEventListener('click', async () => {
			const text = button.getAttribute(dataAttr);
			if (text) {
				await copyToClipboard(text, button as HTMLElement);
			}
		});
	});
}

/**
 * Reveals elements flagged as "iOS only".
 * @param selector CSS selector for the elements.
 */
export function revealIOSOnly(selector: string = '[data-apple-link]') {
	if (isIOS()) {
		const elements = document.querySelectorAll(selector);
		elements.forEach((el) => {
			(el as HTMLElement).classList.remove('u-hidden-initially');
			(el as HTMLElement).style.display = 'flex';
		});
	}
}
