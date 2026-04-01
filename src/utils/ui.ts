/**
 * Shared UI utilities for digital invitations.
 */

/**
 * Detects if the current device is running iOS.
 */
export function isIOS(): boolean {
	if (typeof window === 'undefined') return false;
	const ua = navigator.userAgent;
	const touchCapableNavigator = navigator as Navigator & { maxTouchPoints?: number };
	return (
		/iPad|iPhone|iPod/.test(ua) ||
		(ua.includes('Mac') && (touchCapableNavigator.maxTouchPoints || 0) > 1)
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
		const originalAriaLabel = button.getAttribute('aria-label');
		const originalTitle = button.getAttribute('title');
		button.innerHTML = '<span class="copy-success">✓</span>';
		button.classList.add('copy-success');
		button.setAttribute('aria-label', 'Dirección copiada');
		button.setAttribute('title', 'Dirección copiada');

		setTimeout(() => {
			button.innerHTML = originalContent;
			button.classList.remove('copy-success');
			if (originalAriaLabel) {
				button.setAttribute('aria-label', originalAriaLabel);
			} else {
				button.removeAttribute('aria-label');
			}
			if (originalTitle) {
				button.setAttribute('title', originalTitle);
			} else {
				button.removeAttribute('title');
			}
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
	root: ParentNode = document,
) {
	const copyButtons = root.querySelectorAll(selector);
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
export function revealIOSOnly(selector: string = '[data-apple-link]', root: ParentNode = document) {
	if (isIOS()) {
		const elements = root.querySelectorAll(selector);
		elements.forEach((el) => {
			(el as HTMLElement).classList.remove('u-hidden-initially');
			(el as HTMLElement).style.display = 'flex';
		});
	}
}
