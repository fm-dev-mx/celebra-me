export function formatPhoneDisplay(phone: string | null | undefined): string {
	if (!phone) return '';
	const trimmed = phone.trim();
	const digits = trimmed.replace(/[\s-]/g, '');
	if (/^\d{10}$/.test(digits)) {
		return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
	}
	return trimmed;
}
