/**
 * registry.ts — Invitation Definition Registry
 *
 * Central sitemap/registry for single-file invitation definitions.
 */

import type { InvitationDefinition } from './invitation-definition.ts';
import { albaInvitation } from './alba-rosa-quinonez.ts';
import { abrilInvitation } from './abril-michelle-becerra-rea.ts';
import { rominaInvitation } from './romina-rios-chaparro.ts';

const registry = new Map<string, InvitationDefinition>();
const hostLoginAliases = new Map<string, string>();

function registerInvitation(definition: InvitationDefinition): void {
	if (registry.has(definition.slug)) {
		throw new Error(`Duplicate invitation slug registration: "${definition.slug}".`);
	}
	const alias = definition.hostLoginAlias;
	const ownerSlug = hostLoginAliases.get(alias);
	if (ownerSlug) {
		throw new Error(
			`Duplicate hostLoginAlias "${alias}" for "${definition.slug}" (already used by "${ownerSlug}").`,
		);
	}
	registry.set(definition.slug, definition);
	hostLoginAliases.set(alias, definition.slug);
}

// Register canonical invitations
registerInvitation(albaInvitation);
registerInvitation(abrilInvitation);
registerInvitation(rominaInvitation);

/**
 * Resolve an invitation definition by slug.
 * Throws a clear error if the slug is not registered.
 */
export function getInvitationDefinition(slug: string): InvitationDefinition {
	const definition = registry.get(slug);
	if (!definition) {
		const available = Array.from(registry.keys()).join(', ');
		throw new Error(
			`Invitation definition with slug "${slug}" not found in registry. Available: [${available}]`,
		);
	}
	return definition;
}

/**
 * List all registered invitation definitions.
 */
export function listInvitationDefinitions(): InvitationDefinition[] {
	return Array.from(registry.values());
}
