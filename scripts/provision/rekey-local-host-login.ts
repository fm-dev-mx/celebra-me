/**
 * Remap Local invitation host Auth email + login_alias from definition.hostLoginAlias.
 *
 * Ownership UUIDs are preserved. Preview/Production are intentionally unsupported here.
 *
 * Usage:
 *   pnpm tsx scripts/provision/rekey-local-host-login.ts --slug <slug> [--apply]
 *   pnpm tsx scripts/provision/rekey-local-host-login.ts --all-short [--apply]
 */

import {
	buildInvitationHostEmail,
	findAuthUserIdByEmail,
	updateInvitationHostLogin,
} from './invitation-host-owner.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { resolveLocalEnv } from './local-provision-env.ts';

const SHORT_ALIAS_SLUGS = ['abril-michelle-becerra-rea', 'alba-rosa-quinones'] as const;

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

	const ownerResult = runPsql(
		`select created_by::text from public.invitations
		 where slug = ${sqlLiteral(input.slug)} and archived_at is null
		 limit 1;`,
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const ownerUserId = ownerResult.stdout.trim();
	if (!ownerUserId) {
		throw new Error(`No active invitation found for slug "${input.slug}".`);
	}

	const currentEmailResult = runPsql(
		`select lower(email) from auth.users where id = ${sqlLiteral(ownerUserId)}::uuid;`,
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const currentEmail = currentEmailResult.stdout.trim();
	const existingTargetOwner = findAuthUserIdByEmail(input.dbUrl, targetEmail);

	console.log(
		JSON.stringify(
			{
				slug: input.slug,
				ownerUserId,
				currentEmail,
				targetAlias,
				targetEmail,
				alreadyCurrent: currentEmail === targetEmail,
				targetEmailOwnedByOther:
					Boolean(existingTargetOwner) && existingTargetOwner !== ownerUserId,
				mode: input.apply ? 'apply' : 'dry-run',
			},
			null,
			2,
		),
	);

	if (currentEmail === targetEmail) {
		console.log(`OK: "${input.slug}" already uses ${targetAlias}`);
		return;
	}
	if (existingTargetOwner && existingTargetOwner !== ownerUserId) {
		throw new Error(
			`Target email "${targetEmail}" already belongs to another Auth user (${existingTargetOwner}).`,
		);
	}
	if (!input.apply) {
		console.log(`Dry-run only. Re-run with --apply to remap "${input.slug}".`);
		return;
	}

	const result = await updateInvitationHostLogin({
		supabaseUrl: input.apiUrl,
		serviceRoleKey: input.serviceRoleKey,
		targetDbUrl: input.dbUrl,
		userId: ownerUserId,
		newHostLoginAlias: targetAlias,
	});
	console.log(`Remapped "${input.slug}" → ${result.hostLoginAlias} (${result.hostEmail})`);
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
