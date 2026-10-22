import fs from 'node:fs';
import path from 'node:path';

/**
 * Where invitation definitions live, relative to the repository root.
 *
 * - New client invitations: one folder each, `src/invitations/clients/<slug>/`, holding
 *   `invitation.ts` (the definition, default export), an optional token-only `profile.scss`
 *   (its visualProfileId is the slug) and `assets/` (the definition's assetDir).
 * - Legacy definitions: `scripts/provision/invitations/<slug>.ts`. That list is frozen; each file
 *   leaves when its invitation expires.
 */
export const CLIENT_INVITATIONS_DIR = 'src/invitations/clients';
export const LEGACY_DEFINITIONS_DIR = 'scripts/provision/invitations';

export function clientInvitationDir(slug: string): string {
	return `${CLIENT_INVITATIONS_DIR}/${slug}`;
}

export function clientInvitationAssetDir(slug: string): string {
	return `${clientInvitationDir(slug)}/assets`;
}

/** Slugs of the client invitation folders that hold an `invitation.ts`, sorted. */
export function listClientInvitationSlugs(root = process.cwd()): string[] {
	const dir = path.join(root, CLIENT_INVITATIONS_DIR);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, 'invitation.ts')),
		)
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

/** The repository path of a slug's definition module: its folder's `invitation.ts`, else legacy. */
export function invitationDefinitionFile(slug: string, root = process.cwd()): string {
	const folderFile = `${clientInvitationDir(slug)}/invitation.ts`;
	return fs.existsSync(path.join(root, folderFile))
		? folderFile
		: `${LEGACY_DEFINITIONS_DIR}/${slug}.ts`;
}

/** Every definition module on disk, as repository paths: legacy files, then client folders. */
export function listInvitationDefinitionFiles(root = process.cwd()): string[] {
	const legacyDir = path.join(root, LEGACY_DEFINITIONS_DIR);
	const legacy = fs
		.readdirSync(legacyDir)
		.filter((name) => name.endsWith('.ts'))
		.map((name) => `${LEGACY_DEFINITIONS_DIR}/${name}`);
	const clients = listClientInvitationSlugs(root).map(
		(slug) => `${clientInvitationDir(slug)}/invitation.ts`,
	);
	return [...legacy, ...clients];
}

/** True for a path that may hold a definition: a legacy module or a client folder's invitation.ts. */
export function isInvitationDefinitionPath(file: string): boolean {
	const normalized = file.replaceAll('\\', '/');
	return (
		new RegExp(`^${LEGACY_DEFINITIONS_DIR}/[^/]+\\.ts$`, 'u').test(normalized) ||
		new RegExp(`^${CLIENT_INVITATIONS_DIR}/[^/]+/invitation\\.ts$`, 'u').test(normalized)
	);
}
