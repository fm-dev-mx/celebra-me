// =============================================================================
// CELEBRA-ME | Screenshot Tool — Canonical Invitation Discovery Service
// =============================================================================

import * as syncFs from 'node:fs';
import * as path from 'node:path';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { assertInvitationCatalogIntegrity } from './registry-validation.js';

export interface DiscoveredInvitation {
	name: string;
	route: string;
	slug: string;
	eventType: string;
	source: 'published' | 'provisioned' | 'demo' | 'template';
}

/**
 * Discover static event demos from src/content/event-demos
 */
export function discoverStaticDemos(): DiscoveredInvitation[] {
	const demosDir = path.join(process.cwd(), 'src/content/event-demos');
	const results: DiscoveredInvitation[] = [];

	if (!syncFs.existsSync(demosDir)) return results;

	const folders = syncFs.readdirSync(demosDir);
	for (const folder of folders) {
		const folderPath = path.join(demosDir, folder);
		if (!syncFs.statSync(folderPath).isDirectory()) continue;

		const files = syncFs.readdirSync(folderPath);
		for (const file of files) {
			if (!file.endsWith('.json') || file.startsWith('_')) continue;

			try {
				const contentStr = syncFs.readFileSync(path.join(folderPath, file), 'utf8');
				const content = JSON.parse(contentStr);

				const eventType = content.eventType || folder;
				const slug = file.replace(/\.json$/, '');
				const route = `/${eventType}/${slug}`;

				results.push({
					name: content.title || `${eventType}: ${slug}`,
					route,
					slug,
					eventType,
					source: 'demo',
				});
			} catch (error) {
				throw new Error(
					`Invalid static demo file "${path.join(folderPath, file)}": ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
		}
	}

	return results;
}

/**
 * Discover static event templates from src/content/event-templates
 */
export function discoverStaticTemplates(): DiscoveredInvitation[] {
	const templatesDir = path.join(process.cwd(), 'src/content/event-templates');
	const results: DiscoveredInvitation[] = [];

	if (!syncFs.existsSync(templatesDir)) return results;

	const folders = syncFs.readdirSync(templatesDir);
	for (const folder of folders) {
		const folderPath = path.join(templatesDir, folder);
		if (!syncFs.statSync(folderPath).isDirectory()) continue;

		const files = syncFs.readdirSync(folderPath);
		for (const file of files) {
			if (!file.endsWith('.json') || file.startsWith('_')) continue;

			try {
				const contentStr = syncFs.readFileSync(path.join(folderPath, file), 'utf8');
				const content = JSON.parse(contentStr);

				const eventType = content.eventType || folder;
				const slug = file.replace(/\.json$/, '');
				const route = `/${eventType}/${slug}`;

				results.push({
					name: content.title || `Template ${eventType}: ${slug}`,
					route,
					slug,
					eventType,
					source: 'template',
				});
			} catch (error) {
				throw new Error(
					`Invalid static template file "${path.join(folderPath, file)}": ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
		}
	}

	return results;
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
 * Discover all invitations from static demos, templates, provisioned registry,
 * and database-published invitations if available.
 * Validates and returns every discovered invitation. Route collisions are
 * configuration errors rather than silently selected by source priority.
 */
export function discoverAllInvitations(): DiscoveredInvitation[] {
	const all: DiscoveredInvitation[] = [
		...discoverProvisionedInvitations(),
		...discoverStaticDemos(),
		...discoverStaticTemplates(),
	];

	assertInvitationCatalogIntegrity(all);
	return all.sort((a, b) => a.name.localeCompare(b.name));
}
