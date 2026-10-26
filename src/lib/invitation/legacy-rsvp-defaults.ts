/*
  Invitations that keep the RSVP defaults they were delivered with. Every other invitation gets the
  floating reply button on its personal link and the «usted» default RSVP copy; these keep both off
  so a published invitation renders exactly as it did when the client approved it.

  Server-only: the list names client invitations, so it never ships to the browser. Never add an
  entry; an entry leaves only when its invitation is deleted.
*/

const LEGACY_RSVP_DEFAULT_SLUGS: ReadonlySet<string> = new Set([
	// Client invitations published before 2026-10-25.
	'abril-michelle-becerra-rea',
	'aithan-darell',
	'alba-rosa-quinonez',
	'allison-scarlett',
	'america',
	'andrea',
	'daniela-y-martin',
	'leslie-perez',
	'melissa-y-luis-osmar',
	'mia-pintor',
	'norma-hernandez',
	'olivia-y-antonio',
	'renata',
	'romina-rios-chaparro',
	'valentina-hernandez',
	'victoria-y-roberto',
	// Published, definition retired, still public until the validity window closes.
	'america-johana',
	'leah-lexa',
	'luna-y-estrella',
	'xareni-iyarit',
	// Demo the owner keeps in «tú» (d168).
	'demo-xv-editorial',
]);

export function keepsLegacyRsvpDefaults(slug: string): boolean {
	return LEGACY_RSVP_DEFAULT_SLUGS.has(slug);
}

export function listLegacyRsvpDefaultSlugs(): string[] {
	return [...LEGACY_RSVP_DEFAULT_SLUGS];
}
