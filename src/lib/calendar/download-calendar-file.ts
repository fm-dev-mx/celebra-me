export function downloadIcsFile(icsContent: string, fileName: string = 'evento'): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;

	const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `${fileName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.ics`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);

	URL.revokeObjectURL(url);
}
