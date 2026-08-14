/**
 * registry.ts — Invitation Definition Registry
 *
 * Central sitemap/registry for single-file invitation definitions.
 */

import type { InvitationDefinition } from './invitation-definition.ts';
import { albaInvitation } from './alba-rosa-quinonez.ts';
import { abrilInvitation } from './abril-michelle-becerra-rea.ts';
import { danielaInvitation } from './daniela-y-martin.ts';
import { rominaInvitation } from './romina-rios-chaparro.ts';
import { victoriaInvitation } from './victoria-y-roberto.ts';
import { renataInvitation } from './renata.ts';
import { leslieInvitation } from './leslie-perez.ts';

const registry = new Map<string, InvitationDefinition>();
const hostLoginAliases = new Map<string, string>();
const managedIdentities = new Map<string, string>();
const previousSlugOwners = new Map<string, string>();

function registerInvitation(definition: InvitationDefinition): void {
	if (registry.has(definition.slug)) {
		throw new Error(`Duplicate invitation slug registration: "${definition.slug}".`);
	}
	const identityOwner = managedIdentities.get(definition.managedIdentityId);
	if (identityOwner) {
		throw new Error(
			`Duplicate managedIdentityId "${definition.managedIdentityId}" for "${definition.slug}" (already used by "${identityOwner}").`,
		);
	}
	const alias = definition.hostLoginAlias;
	const ownerSlug = hostLoginAliases.get(alias);
	if (ownerSlug) {
		throw new Error(
			`Duplicate hostLoginAlias "${alias}" for "${definition.slug}" (already used by "${ownerSlug}").`,
		);
	}
	const previousOwnerOfCurrent = previousSlugOwners.get(definition.slug);
	if (previousOwnerOfCurrent) {
		throw new Error(
			`Slug "${definition.slug}" is declared as previousSlugs for "${previousOwnerOfCurrent}"; cannot register as current slug.`,
		);
	}
	for (const previousSlug of definition.previousSlugs ?? []) {
		if (registry.has(previousSlug)) {
			throw new Error(
				`previousSlugs entry "${previousSlug}" for "${definition.slug}" collides with registered slug.`,
			);
		}
		const prior = previousSlugOwners.get(previousSlug);
		if (prior) {
			throw new Error(
				`Duplicate previousSlugs entry "${previousSlug}" for "${definition.slug}" (already used by "${prior}").`,
			);
		}
		previousSlugOwners.set(previousSlug, definition.slug);
	}
	registry.set(definition.slug, definition);
	hostLoginAliases.set(alias, definition.slug);
	managedIdentities.set(definition.managedIdentityId, definition.slug);
}

// Register canonical invitations
registerInvitation(albaInvitation);
registerInvitation(abrilInvitation);
registerInvitation(danielaInvitation);
registerInvitation(rominaInvitation);
registerInvitation(victoriaInvitation);
registerInvitation(renataInvitation);
registerInvitation(leslieInvitation);

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
