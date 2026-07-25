// =============================================================================
// CELEBRA-ME | Screenshot Tool — Canonical Invitation Discovery Service
// =============================================================================

import * as syncFs from 'node:fs';
import * as path from 'node:path';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';

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
			} catch {
				// Ignore invalid files
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
			} catch {
				// Ignore invalid files
			}
		}
	}

	return results;
}

/**
 * Discover canonical provisioned invitations from scripts/provision/invitations/registry.ts
 */
export function discoverProvisionedInvitations(): DiscoveredInvitation[] {
	try {
		const definitions = listInvitationDefinitions();
		return definitions.map((def) => ({
			name: def.title || `Provisioned: ${def.slug}`,
			route: `/${def.eventType}/${def.slug}`,
			slug: def.slug,
			eventType: def.eventType,
			source: 'provisioned',
		}));
	} catch {
		return [];
	}
}

/**
 * Discover all invitations from static demos, templates, provisioned registry,
 * and database-published invitations if available.
 * Normalizes and deduplicates by canonical route using explicit source priority:
 * 1. Database Published
 * 2. Provisioned Registry
 * 3. Static Demo
 * 4. Static Template
 */
export function discoverAllInvitations(): DiscoveredInvitation[] {
	const all: DiscoveredInvitation[] = [
		...discoverProvisionedInvitations(),
		...discoverStaticDemos(),
		...discoverStaticTemplates(),
	];

	// Map keyed by canonical route
	const map = new Map<string, DiscoveredInvitation>();

	// Priority mapping (higher number = higher priority)
	const priority: Record<DiscoveredInvitation['source'], number> = {
		published: 4,
		provisioned: 3,
		demo: 2,
		template: 1,
	};

	for (const item of all) {
		const normalizedRoute = item.route.toLowerCase();
		const existing = map.get(normalizedRoute);

		if (!existing || priority[item.source] > priority[existing.source]) {
			map.set(normalizedRoute, item);
		}
	}

	return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
