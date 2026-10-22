/**
 * registry.ts — Invitation Definition Registry
 *
 * Central sitemap/registry for invitation definitions. New invitations get a folder under
 * src/invitations/clients/ and arrive through client-registry.generated.ts. The legacy list below
 * is frozen: a test refuses new single-file definitions, and each one leaves when it expires.
 */

import {
	isExpiredInvitationDefinition,
	type InvitationDefinition,
} from './invitation-definition.ts';
import { allisonInvitation } from './allison-scarlett.ts';
import { normaInvitation } from './norma-hernandez.ts';
import { albaInvitation } from './alba-rosa-quinonez.ts';
import { abrilInvitation } from './abril-michelle-becerra-rea.ts';
import { danielaInvitation } from './daniela-y-martin.ts';
import { rominaInvitation } from './romina-rios-chaparro.ts';
import { victoriaInvitation } from './victoria-y-roberto.ts';
import { melissaInvitation } from './melissa-y-luis-osmar.ts';
import { renataInvitation } from './renata.ts';
import { leslieInvitation } from './leslie-perez.ts';
import { valentinaInvitation } from './valentina-hernandez.ts';
import { destenidInvitation } from './destenid-sofia.ts';
import { miaInvitation } from './mia-pintor.ts';
import { naydelinInvitation } from './naydelin-paredes.ts';
import { aithanInvitation } from './aithan-darell.ts';
import { americaSolisInvitation } from './america.ts';
import { oliviaAntonioInvitation } from './olivia-y-antonio.ts';
import { CLIENT_INVITATION_DEFINITIONS } from './client-registry.generated.ts';

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

// Register the frozen legacy definitions
registerInvitation(allisonInvitation);
registerInvitation(normaInvitation);
registerInvitation(albaInvitation);
registerInvitation(abrilInvitation);
registerInvitation(danielaInvitation);
registerInvitation(rominaInvitation);
registerInvitation(victoriaInvitation);
registerInvitation(melissaInvitation);
registerInvitation(renataInvitation);
registerInvitation(leslieInvitation);
registerInvitation(valentinaInvitation);
registerInvitation(destenidInvitation);
registerInvitation(naydelinInvitation);
registerInvitation(miaInvitation);
registerInvitation(aithanInvitation);
registerInvitation(americaSolisInvitation);
registerInvitation(oliviaAntonioInvitation);

for (const definition of CLIENT_INVITATION_DEFINITIONS) registerInvitation(definition);

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

/** Definitions that still take part in release planning (their validity window is open). */
export function listActiveInvitationDefinitions(now = new Date()): InvitationDefinition[] {
	return listInvitationDefinitions().filter(
		(definition) => !isExpiredInvitationDefinition(definition, now),
	);
}

/** Definitions past their validity window (event date + 1 year), reported apart from planning. */
export function listExpiredInvitationDefinitions(now = new Date()): InvitationDefinition[] {
	return listInvitationDefinitions().filter((definition) =>
		isExpiredInvitationDefinition(definition, now),
	);
}

/** Active definitions that hosted targets may receive. */
export function listPublishedInvitationDefinitions(now = new Date()): InvitationDefinition[] {
	return listActiveInvitationDefinitions(now).filter(
		(definition) => definition.lifecycle === 'published',
	);
}

/** Active definitions still in authoring; Local only, reported apart from release planning. */
export function listAuthoringInvitationDefinitions(now = new Date()): InvitationDefinition[] {
	return listActiveInvitationDefinitions(now).filter(
		(definition) => definition.lifecycle === 'in_progress',
	);
}
