/**
 * Remap Local invitation host Auth email + login_alias from definition.hostLoginAlias.
 *
 * Ownership UUIDs are preserved unless the invitation is already owned by the target host.
 * Preview/Production are intentionally unsupported here.
 *
 * Resolution order for the Auth user to rekey:
 * 1. Existing Auth user whose email matches the target hostLoginAlias
 * 2. Existing Auth user whose email matches the slug-derived legacy alias
 * 3. Invitation created_by when that user is on @clientes.celebra.invalid
 *
 * Usage:
 *   pnpm tsx scripts/provision/rekey-local-host-login.ts --slug <slug> [--apply]
 *   pnpm tsx scripts/provision/rekey-local-host-login.ts --all-short [--apply]
 */

import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	buildInvitationHostEmail,
	findAuthUserIdByEmail,
	INVITATION_HOST_EMAIL_DOMAIN,
	updateInvitationHostLogin,
} from './invitation-host-owner.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import { resolveLocalEnv } from './local-provision-env.ts';

const SHORT_ALIAS_SLUGS = ['abril-michelle-becerra-rea', 'alba-rosa-quinonez'] as const;

function legacyAliasFromSlug(slug: string): string {
	return slug
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function parseArgs(argv: string[]): { slugs: string[]; apply: boolean } {
	const apply = argv.includes('--apply');
	if (argv.includes('--all-short')) {
		return { slugs: [...SHORT_ALIAS_SLUGS], apply };
	}
	const slugIndex = argv.indexOf('--slug');
	const slug = slugIndex >= 0 ? argv[slugIndex + 1] : undefined;
	if (!slug) {
		throw new Error(
			'Usage: rekey-local-host-login.ts --slug <slug> [--apply] | --all-short [--apply]',
		);
	}
	return { slugs: [slug], apply };
}

function loadAuthEmail(dbUrl: string, userId: string): string {
	const result = runPsql(
		`select lower(email) from auth.users where id = ${sqlLiteral(userId)}::uuid;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	return result.stdout.trim();
}

function resolveHostUserId(input: {
	slug: string;
	dbUrl: string;
	targetEmail: string;
}): { userId: string; source: 'target' | 'legacy' | 'invitation-owner' } | null {
	const targetOwner = findAuthUserIdByEmail(input.dbUrl, input.targetEmail);
	if (targetOwner) {
		return { userId: targetOwner, source: 'target' };
	}

	const legacyEmail = `${legacyAliasFromSlug(input.slug)}@${INVITATION_HOST_EMAIL_DOMAIN}`;
	const legacyOwner = findAuthUserIdByEmail(input.dbUrl, legacyEmail);
	if (legacyOwner) {
		return { userId: legacyOwner, source: 'legacy' };
	}

	const ownerResult = runPsql(
		`select created_by::text from public.invitations
		 where slug = ${sqlLiteral(input.slug)} and archived_at is null
		 limit 1;`,
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const ownerUserId = ownerResult.stdout.trim();
	if (!ownerUserId) return null;
	const ownerEmail = loadAuthEmail(input.dbUrl, ownerUserId);
	if (ownerEmail.endsWith(`@${INVITATION_HOST_EMAIL_DOMAIN}`)) {
		return { userId: ownerUserId, source: 'invitation-owner' };
	}
	return null;
}

async function rekeySlug(input: {
	slug: string;
	apply: boolean;
	apiUrl: string;
	dbUrl: string;
	serviceRoleKey: string;
}): Promise<void> {
	const definition = getInvitationDefinition(input.slug);
	const targetAlias = definition.hostLoginAlias;
	const targetEmail = buildInvitationHostEmail(targetAlias);
	const resolved = resolveHostUserId({
		slug: input.slug,
		dbUrl: input.dbUrl,
		targetEmail,
	});

	if (!resolved) {
		throw new Error(
			`No dedicated host Auth user found for "${input.slug}" (target, legacy slug alias, or invitation owner on ${INVITATION_HOST_EMAIL_DOMAIN}).`,
		);
	}

	const currentEmail = loadAuthEmail(input.dbUrl, resolved.userId);
	const existingTargetOwner = findAuthUserIdByEmail(input.dbUrl, targetEmail);

	console.log(
		JSON.stringify(
			{
				slug: input.slug,
				userId: resolved.userId,
				resolveSource: resolved.source,
				currentEmail,
				targetAlias,
				targetEmail,
				alreadyCurrent: currentEmail === targetEmail,
				targetEmailOwnedByOther:
					Boolean(existingTargetOwner) && existingTargetOwner !== resolved.userId,
				mode: input.apply ? 'apply' : 'dry-run',
			},
			null,
			2,
		),
	);

	if (existingTargetOwner && existingTargetOwner !== resolved.userId) {
		throw new Error(
			`Target email "${targetEmail}" already belongs to another Auth user (${existingTargetOwner}).`,
		);
	}
	if (!input.apply) {
		console.log(`Dry-run only. Re-run with --apply to remap "${input.slug}".`);
		return;
	}

	if (currentEmail !== targetEmail) {
		const result = await updateInvitationHostLogin({
			supabaseUrl: input.apiUrl,
			serviceRoleKey: input.serviceRoleKey,
			targetDbUrl: input.dbUrl,
			userId: resolved.userId,
			newHostLoginAlias: targetAlias,
		});
		console.log(`Remapped "${input.slug}" → ${result.hostLoginAlias} (${result.hostEmail})`);
	} else {
		console.log(`OK: "${input.slug}" already uses ${targetAlias}`);
	}
}

async function main(): Promise<void> {
	const { slugs, apply } = parseArgs(process.argv.slice(2));
	const env = resolveLocalEnv();

	// Touch registry so duplicate-alias registration fails fast if definitions are broken.
	listInvitationDefinitions();

	for (const slug of slugs) {
		await rekeySlug({
			slug,
			apply,
			apiUrl: env.apiUrl,
			dbUrl: env.dbUrl,
			serviceRoleKey: env.serviceRoleKey,
		});
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
