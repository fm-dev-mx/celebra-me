/**
 * Build-time contact phone rules. `CONTACT_WHATSAPP` is inlined by Vite when `astro build` runs
 * (the home page is prerendered), so the Worker secret of the same name never reaches it: the
 * value must be present in the build environment.
 */
export const PLACEHOLDER_CONTACT_PHONE = '521000000000';

/** Fails a Production build that would ship the placeholder number in every wa.me link. */
export function assertProductionContactPhone(
	deployEnvironment: string | null,
	phone: string | undefined,
): void {
	if (deployEnvironment !== 'production') return;
	const digits = (phone ?? '').replace(/\D/g, '');
	if (digits.length < 10 || digits === PLACEHOLDER_CONTACT_PHONE || /^0+$/.test(digits)) {
		throw new Error(
			'CONTACT_WHATSAPP is missing or is the placeholder number; a Production build would ship it in every WhatsApp link.',
		);
	}
}
