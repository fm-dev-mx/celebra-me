// =============================================================================
// CELEBRA-ME | Screenshot Tool — Canonical Invitation Discovery Service
// =============================================================================

import * as syncFs from 'node:fs';
import * as path from 'node:path';
import { DEMO_INVITATIONS_DIR, listDemoInvitationFiles } from '../shared/demo-invitation-files.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { assertInvitationCatalogIntegrity } from './registry-validation.js';
import { buildPublicInvitationPath } from '../../src/utils/invitation-link.ts';

export interface DiscoveredInvitation {
	name: string;
	route: string;
	slug: string;
	eventType: string;
	source: 'published' | 'provisioned' | 'demo';
}

/**
 * Discover static event demos from src/invitations/demos
 */
export function discoverStaticDemos(): DiscoveredInvitation[] {
	const demosDir = path.join(process.cwd(), DEMO_INVITATIONS_DIR);
	if (!syncFs.existsSync(demosDir)) return [];
	return listDemoInvitationFiles(demosDir).map(({ slug, eventType, content }) => ({
		name:
			typeof content.title === 'string' && content.title
				? content.title
				: `${eventType}: ${slug}`,
		route: buildPublicInvitationPath(eventType, slug),
		slug,
		eventType,
		source: 'demo',
	}));
}

/**
 * Discover canonical provisioned invitations from scripts/provision/invitations/registry.ts
 */
export function discoverProvisionedInvitations(): DiscoveredInvitation[] {
	const definitions = listInvitationDefinitions();
	return definitions.map((def) => ({
		name: def.title || `Provisioned: ${def.slug}`,
		route: `/${def.eventType}/${def.slug}`,
		slug: def.slug,
		eventType: def.eventType,
		source: 'provisioned',
	}));
}

/**
 * Discover all invitations from static demos, provisioned registry,
 * and database-published invitations if available.
 * Validates and returns every discovered invitation. Route collisions are
 * configuration errors rather than silently selected by source priority.
 */
export function discoverAllInvitations(): DiscoveredInvitation[] {
	const all: DiscoveredInvitation[] = [
		...discoverProvisionedInvitations(),
		...discoverStaticDemos(),
	];

	assertInvitationCatalogIntegrity(all);
	return all.sort((a, b) => a.name.localeCompare(b.name));
}
