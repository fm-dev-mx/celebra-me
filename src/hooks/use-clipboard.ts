import { useCallback, useEffect, useRef, useState } from 'react';

export type ClipboardStatus = 'idle' | 'copied' | 'failed';

/** Legacy path for insecure contexts and in-app browsers without the async Clipboard API. */
function copyWithSelection(text: string): boolean {
	if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
		return false;
	}
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.top = '0';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	const previousFocus = document.activeElement as HTMLElement | null;
	textarea.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		textarea.remove();
		previousFocus?.focus?.();
	}
}

export async function writeClipboardText(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Permission denied or blocked context: try the selection fallback.
		}
	}
	return copyWithSelection(text);
}

/**
 * Copies text and reports the outcome; `failed` lets callers offer a manual
 * fallback instead of failing silently.
 */
export function useClipboard(resetMs = 2000) {
	const [status, setStatus] = useState<ClipboardStatus>('idle');
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const copy = useCallback(
		async (text: string) => {
			clearTimeout(timerRef.current);
			const ok = await writeClipboardText(text);
			setStatus(ok ? 'copied' : 'failed');
			if (ok) timerRef.current = setTimeout(() => setStatus('idle'), resetMs);
			return ok;
		},
		[resetMs],
	);

	const reset = useCallback(() => {
		clearTimeout(timerRef.current);
		setStatus('idle');
	}, []);

	return { copied: status === 'copied', status, copy, reset };
}
