/**
 * Invitation host ownership — plan and ensure a dedicated Auth host per client invitation.
 *
 * UUID is per environment. Identity is semantic: canonical technical email from hostLoginAlias.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	HOST_LOGIN_ALIAS_MAX_LENGTH,
	HOST_LOGIN_ALIAS_PATTERN,
} from './invitations/invitation-definition.ts';

export const INVITATION_HOST_EMAIL_DOMAIN = 'clientes.celebra.invalid';

export type HostOwnerAction =
	'OWNER_PRESERVE' | 'OWNER_EXPLICIT' | 'OWNER_REUSE' | 'OWNER_CREATE_PLANNED' | 'OWNER_CONFLICT';

export interface HostOwnerPlan {
	action: HostOwnerAction;
	slug: string;
	hostEmail: string;
	hostLoginAlias: string;
	ownerUserId: string | null;
	plannedOwnerUserId: string | null;
	conflictSlug?: string;
	detail: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalize a host login alias to the canonical local-part form. */
export function normalizeHostLoginAlias(alias: string): string {
	const normalized = alias
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, HOST_LOGIN_ALIAS_MAX_LENGTH);
	if (!normalized || !HOST_LOGIN_ALIAS_PATTERN.test(normalized)) {
		throw new Error(`Cannot build invitation host email: invalid hostLoginAlias "${alias}".`);
	}
	return normalized;
}

/** Canonical technical host email for a managed invitation hostLoginAlias. */
export function buildInvitationHostEmail(hostLoginAlias: string): string {
	const alias = normalizeHostLoginAlias(hostLoginAlias);
	return `${alias}@${INVITATION_HOST_EMAIL_DOMAIN}`;
}

export function planInvitationHostOwner(input: {
	slug: string;
	hostLoginAlias: string;
	existingOwnerUserId?: string | null;
	explicitOwnerId?: string;
	hostEmail?: string;
	/** User id for the canonical host email, if any. */
	existingHostUserId?: string | null;
	/** Another active invitation slug already owned by the canonical host user. */
	hostOwnsOtherSlug?: string | null;
	/** Explicit owner exists in auth.users. */
	explicitOwnerExists?: boolean;
	/** Preferred UUID when planning a create (plan→apply stability). */
	preferredCreateOwnerId?: string;
}): HostOwnerPlan {
	const hostLoginAlias = normalizeHostLoginAlias(input.hostLoginAlias);
	const hostEmail = input.hostEmail ?? buildInvitationHostEmail(hostLoginAlias);
	const existingOwner = input.existingOwnerUserId?.trim() || null;

	if (existingOwner) {
		if (input.explicitOwnerId && input.explicitOwnerId !== existingOwner) {
			return {
				action: 'OWNER_CONFLICT',
				slug: input.slug,
				hostEmail,
				hostLoginAlias,
				ownerUserId: existingOwner,
				plannedOwnerUserId: null,
				detail: `--owner-user-id does not match the existing target owner for "${input.slug}".`,
			};
		}
		return {
			action: 'OWNER_PRESERVE',
			slug: input.slug,
			hostEmail,
			hostLoginAlias,
			ownerUserId: existingOwner,
			plannedOwnerUserId: existingOwner,
			detail: `Preserve existing owner for "${input.slug}".`,
		};
	}

	if (input.explicitOwnerId) {
		if (!UUID_PATTERN.test(input.explicitOwnerId)) {
			return {
				action: 'OWNER_CONFLICT',
				slug: input.slug,
				hostEmail,
				hostLoginAlias,
				ownerUserId: null,
				plannedOwnerUserId: null,
				detail: `--owner-user-id is not a valid UUID.`,
			};
		}
		if (input.explicitOwnerExists === false) {
			return {
				action: 'OWNER_CONFLICT',
				slug: input.slug,
				hostEmail,
				hostLoginAlias,
				ownerUserId: null,
				plannedOwnerUserId: null,
				detail: `Target owner UUID "${input.explicitOwnerId}" does not exist in target auth.users table.`,
			};
		}
		return {
			action: 'OWNER_EXPLICIT',
			slug: input.slug,
			hostEmail,
			hostLoginAlias,
			ownerUserId: input.explicitOwnerId,
			plannedOwnerUserId: input.explicitOwnerId,
			detail: `Use explicit --owner-user-id for new invitation "${input.slug}".`,
		};
	}

	const hostUserId = input.existingHostUserId?.trim() || null;
	if (hostUserId) {
		if (input.hostOwnsOtherSlug) {
			return {
				action: 'OWNER_CONFLICT',
				slug: input.slug,
				hostEmail,
				hostLoginAlias,
				ownerUserId: hostUserId,
				plannedOwnerUserId: null,
				conflictSlug: input.hostOwnsOtherSlug,
				detail: `Host email "${hostEmail}" already owns active invitation "${input.hostOwnsOtherSlug}".`,
			};
		}
		return {
			action: 'OWNER_REUSE',
			slug: input.slug,
			hostEmail,
			hostLoginAlias,
			ownerUserId: hostUserId,
			plannedOwnerUserId: hostUserId,
			detail: `Reuse existing Auth host "${hostEmail}" for "${input.slug}".`,
		};
	}

	const plannedOwnerUserId =
		input.preferredCreateOwnerId && UUID_PATTERN.test(input.preferredCreateOwnerId)
			? input.preferredCreateOwnerId
			: randomUUID();

	return {
		action: 'OWNER_CREATE_PLANNED',
		slug: input.slug,
		hostEmail,
		hostLoginAlias,
		ownerUserId: null,
		plannedOwnerUserId,
		detail: `Create dedicated Auth host "${hostEmail}" for "${input.slug}".`,
	};
}

export function findAuthUserIdByEmail(dbUrl: string, email: string): string | null {
	const result = runPsql(
		`select id::text from auth.users where lower(email) = lower(${sqlLiteral(email)}) limit 2;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length === 0) return null;
	if (lines.length > 1) {
		throw new Error(`Multiple auth.users rows match email "${email}".`);
	}
	return lines[0] ?? null;
}

export function findOtherActiveInvitationSlugOwnedBy(
	dbUrl: string,
	ownerUserId: string,
	slug: string,
): string | null {
	const result = runPsql(
		`select slug from public.invitations
		 where created_by = ${sqlLiteral(ownerUserId)}::uuid
		   and archived_at is null
		   and slug <> ${sqlLiteral(slug)}
		 order by created_at asc
		 limit 1;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const value = result.stdout.trim();
	return value || null;
}

export function authUserExists(dbUrl: string, userId: string): boolean {
	const result = runPsql(
		`select id from auth.users where id = ${sqlLiteral(userId)}::uuid;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	return Boolean(result.stdout.trim());
}

export function ensureHostClientRole(dbUrl: string, userId: string): void {
	runPsql(
		`insert into public.app_user_roles (user_id, role)
		 values (${sqlLiteral(userId)}::uuid, 'host_client')
		 on conflict (user_id) do update set role = excluded.role, updated_at = now();`,
		dbUrl,
	);
}

export function ensureInvitationHostProfile(
	dbUrl: string,
	userId: string,
	displayName: string,
): void {
	const name = displayName.trim() || 'Host';
	runPsql(
		`insert into public.host_profiles (user_id, display_name)
		 values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(name)})
		 on conflict (user_id) do update set display_name = excluded.display_name;`,
		dbUrl,
	);
}

function buildTemporaryHostPassword(): string {
	return randomBytes(24).toString('base64url');
}

/** Create Auth user via GoTrue Admin API (creates identity). Does not print the password. */
export async function createInvitationHostAuthUser(input: {
	supabaseUrl: string;
	serviceRoleKey: string;
	userId: string;
	email: string;
	loginAlias: string;
}): Promise<string> {
	const url = `${input.supabaseUrl.replace(/\/+$/, '')}/auth/v1/admin/users`;
	const password = buildTemporaryHostPassword();
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			apikey: input.serviceRoleKey,
			Authorization: `Bearer ${input.serviceRoleKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			id: input.userId,
			email: input.email,
			password,
			email_confirm: true,
			user_metadata: {
				login_alias: input.loginAlias,
			},
			app_metadata: {
				provider: 'email',
				providers: ['email'],
				role: 'host_client',
			},
		}),
	});
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(
			`Failed to create invitation host Auth user (HTTP ${response.status}): ${body.slice(0, 200)}`,
		);
	}
	const payload = (await response.json()) as { id?: string; user?: { id?: string } };
	const createdId = payload.id ?? payload.user?.id;
	if (!createdId) {
		throw new Error('Failed to create invitation host Auth user: missing id in response.');
	}
	return createdId;
}

/**
 * Remap an existing host Auth email + login_alias without changing invitation ownership UUIDs.
 * Does not print secrets. Fails if the target email is already used by another user.
 */
export async function updateInvitationHostLogin(input: {
	supabaseUrl: string;
	serviceRoleKey: string;
	targetDbUrl: string;
	userId: string;
	newHostLoginAlias: string;
}): Promise<{ userId: string; hostEmail: string; hostLoginAlias: string }> {
	const hostLoginAlias = normalizeHostLoginAlias(input.newHostLoginAlias);
	const hostEmail = buildInvitationHostEmail(hostLoginAlias);
	const existingForEmail = findAuthUserIdByEmail(input.targetDbUrl, hostEmail);
	if (existingForEmail && existingForEmail !== input.userId) {
		throw new Error(
			`Cannot rekey host login: email "${hostEmail}" already belongs to another Auth user.`,
		);
	}

	const getUrl = `${input.supabaseUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${input.userId}`;
	const existingResponse = await fetch(getUrl, {
		method: 'GET',
		headers: {
			apikey: input.serviceRoleKey,
			Authorization: `Bearer ${input.serviceRoleKey}`,
		},
	});
	if (!existingResponse.ok) {
		const body = await existingResponse.text().catch(() => '');
		throw new Error(
			`Failed to load invitation host Auth user (HTTP ${existingResponse.status}): ${body.slice(0, 200)}`,
		);
	}
	const existingUser = (await existingResponse.json()) as {
		id?: string;
		user_metadata?: Record<string, unknown>;
	};
	if (!existingUser.id) {
		throw new Error('Failed to load invitation host Auth user: missing id in response.');
	}

	const updateResponse = await fetch(getUrl, {
		method: 'PUT',
		headers: {
			apikey: input.serviceRoleKey,
			Authorization: `Bearer ${input.serviceRoleKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			email: hostEmail,
			email_confirm: true,
			user_metadata: {
				...(existingUser.user_metadata || {}),
				login_alias: hostLoginAlias,
			},
		}),
	});
	if (!updateResponse.ok) {
		const body = await updateResponse.text().catch(() => '');
		throw new Error(
			`Failed to update invitation host login (HTTP ${updateResponse.status}): ${body.slice(0, 200)}`,
		);
	}

	return { userId: input.userId, hostEmail, hostLoginAlias };
}

export async function resolveAndEnsureInvitationHostOwner(input: {
	slug: string;
	hostLoginAlias: string;
	displayName: string;
	targetDbUrl: string;
	supabaseUrl: string;
	serviceRoleKey: string | undefined;
	explicitOwnerId?: string;
	existingOwnerUserId?: string | null;
	preferredCreateOwnerId?: string;
	dryRun: boolean;
}): Promise<HostOwnerPlan & { ownerUserId: string }> {
	const hostLoginAlias = normalizeHostLoginAlias(input.hostLoginAlias);
	const hostEmail = buildInvitationHostEmail(hostLoginAlias);
	const existingHostUserId = findAuthUserIdByEmail(input.targetDbUrl, hostEmail);
	const hostOwnsOtherSlug = existingHostUserId
		? findOtherActiveInvitationSlugOwnedBy(input.targetDbUrl, existingHostUserId, input.slug)
		: null;
	const explicitOwnerExists =
		input.explicitOwnerId !== undefined
			? authUserExists(input.targetDbUrl, input.explicitOwnerId)
			: undefined;

	const plan = planInvitationHostOwner({
		slug: input.slug,
		hostLoginAlias,
		existingOwnerUserId: input.existingOwnerUserId,
		explicitOwnerId: input.explicitOwnerId,
		hostEmail,
		existingHostUserId,
		hostOwnsOtherSlug,
		explicitOwnerExists,
		preferredCreateOwnerId: input.preferredCreateOwnerId,
	});

	if (plan.action === 'OWNER_CONFLICT') {
		throw new Error(plan.detail);
	}

	const ownerUserId = plan.plannedOwnerUserId;
	if (!ownerUserId) {
		throw new Error(`Host owner plan for "${input.slug}" did not produce an owner UUID.`);
	}

	if (plan.action === 'OWNER_CREATE_PLANNED' && !input.dryRun) {
		if (!input.serviceRoleKey) {
			throw new Error(
				'Creating an invitation host requires a Supabase service role key for the target environment.',
			);
		}
		if (!authUserExists(input.targetDbUrl, ownerUserId)) {
			await createInvitationHostAuthUser({
				supabaseUrl: input.supabaseUrl,
				serviceRoleKey: input.serviceRoleKey,
				userId: ownerUserId,
				email: hostEmail,
				loginAlias: hostLoginAlias,
			});
		}
		ensureHostClientRole(input.targetDbUrl, ownerUserId);
		ensureInvitationHostProfile(input.targetDbUrl, ownerUserId, input.displayName);
	} else if (plan.action === 'OWNER_REUSE' && !input.dryRun) {
		// Dedicated host reuse only — never rewrite roles for explicit operator overrides.
		ensureHostClientRole(input.targetDbUrl, ownerUserId);
		ensureInvitationHostProfile(input.targetDbUrl, ownerUserId, input.displayName);
	}

	return { ...plan, ownerUserId };
}
