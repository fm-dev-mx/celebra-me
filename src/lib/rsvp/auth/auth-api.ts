import {
	getSupabaseUrl,
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
} from '@/lib/server/supabase-credentials';
import {
	AuthRequestError,
	type AuthOperation,
	type AuthRequestErrorKind,
} from '@/lib/rsvp/core/errors';
import { isRecord } from '@/lib/shared/data-utils';
import {
	buildTemporaryPasswordExpiry,
	TEMP_PASSWORD_EXPIRES_KEY,
} from '@/lib/rsvp/auth/temporary-password';

export const AUTH_REQUEST_TIMEOUT_MS = 5_000;

interface AuthApiOptions<T> {
	operation: AuthOperation;
	path: string;
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	body?: unknown;
	authToken?: string;
	useServiceRole?: boolean;
	validate: (value: unknown) => value is T;
}

export interface SupabaseAuthUser {
	id: string;
	email?: string;
	app_metadata?: {
		role?: string;
		must_change_password?: boolean;
		[key: string]: unknown;
	};
	user_metadata?: Record<string, unknown>;
	amr?: Array<{ method?: string }>;
}

export interface AuthAdminUser {
	id: string;
	email?: string;
	created_at?: string;
	login_alias?: string;
}

type AuthAdminUserRecord = SupabaseAuthUser & {
	created_at?: string;
	user_metadata?: Record<string, unknown>;
	app_metadata?: Record<string, unknown>;
};

type AuthTokenResponse = {
	access_token: string;
	refresh_token: string;
	user: SupabaseAuthUser;
};

type CreateAuthUserResponse = { user: AuthAdminUserRecord } | AuthAdminUserRecord;

function hasStringId(value: unknown): value is { id: string } & Record<string, unknown> {
	return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function isSupabaseAuthUser(value: unknown): value is SupabaseAuthUser {
	return hasStringId(value);
}

function isAuthTokenResponse(value: unknown): value is AuthTokenResponse {
	return (
		isRecord(value) &&
		typeof value.access_token === 'string' &&
		value.access_token.length > 0 &&
		typeof value.refresh_token === 'string' &&
		value.refresh_token.length > 0 &&
		isSupabaseAuthUser(value.user)
	);
}

function isAuthUserListResponse(value: unknown): value is { users: AuthAdminUserRecord[] } {
	return (
		isRecord(value) &&
		Array.isArray(value.users) &&
		value.users.every((user) => hasStringId(user))
	);
}

function isCreateAuthUserResponse(value: unknown): value is CreateAuthUserResponse {
	return hasStringId(value) || (isRecord(value) && hasStringId(value.user));
}

function emitAuthEvent(input: {
	operation: AuthOperation;
	outcome: 'success' | 'failure';
	status?: number;
	errorKind?: AuthRequestErrorKind;
	durationMs: number;
}) {
	console.info(
		JSON.stringify({
			event: 'auth_upstream_request',
			operation: input.operation,
			outcome: input.outcome,
			status: input.status ?? null,
			errorKind: input.errorKind ?? null,
			durationMs: input.durationMs,
		}),
	);
}

async function authRequest<T>(options: AuthApiOptions<T>): Promise<T> {
	const method = options.method ?? 'POST';
	const apiKey = options.useServiceRole ? getSupabaseServiceRoleKey() : getSupabaseAnonKey();
	const requestUrl = `${getSupabaseUrl()}/auth/v1/${options.path}`;
	const controller = new AbortController();
	const startedAt = Date.now();
	let timedOut = false;
	let status: number | undefined;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, AUTH_REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(requestUrl, {
			method,
			headers: {
				apikey: apiKey,
				Authorization: `Bearer ${options.authToken || apiKey}`,
				'Content-Type': 'application/json',
			},
			body: options.body === undefined ? undefined : JSON.stringify(options.body),
			signal: controller.signal,
		});
		status = response.status;
		if (timedOut) {
			throw new AuthRequestError({
				kind: 'timeout',
				operation: options.operation,
				status,
			});
		}

		if (!response.ok) {
			throw new AuthRequestError({ kind: 'http', operation: options.operation, status });
		}

		let parsed: unknown;
		try {
			parsed = response.status === 204 ? null : await response.json();
		} catch {
			throw new AuthRequestError({
				kind: timedOut ? 'timeout' : 'invalid_response',
				operation: options.operation,
				status,
			});
		}
		if (timedOut) {
			throw new AuthRequestError({
				kind: 'timeout',
				operation: options.operation,
				status,
			});
		}

		if (!options.validate(parsed)) {
			throw new AuthRequestError({
				kind: 'invalid_response',
				operation: options.operation,
				status,
			});
		}

		emitAuthEvent({
			operation: options.operation,
			outcome: 'success',
			status,
			durationMs: Date.now() - startedAt,
		});
		return parsed;
	} catch (error) {
		const authError =
			error instanceof AuthRequestError
				? error
				: new AuthRequestError({
						kind: timedOut ? 'timeout' : 'network',
						operation: options.operation,
						status,
					});
		emitAuthEvent({
			operation: options.operation,
			outcome: 'failure',
			status: authError.status,
			errorKind: authError.kind,
			durationMs: Date.now() - startedAt,
		});
		throw authError;
	} finally {
		clearTimeout(timer);
	}
}

function mapAuthAdminUser(user: AuthAdminUserRecord): AuthAdminUser {
	const rawAlias = user.user_metadata?.login_alias;
	return {
		id: user.id,
		email: user.email,
		created_at: user.created_at,
		login_alias: typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : undefined,
	};
}

export async function getAuthUserByAccessToken(accessToken: string): Promise<SupabaseAuthUser> {
	return authRequest({
		operation: 'validate_access_token',
		path: 'user',
		method: 'GET',
		authToken: accessToken,
		validate: isSupabaseAuthUser,
	});
}

export async function signInWithPassword(input: {
	email: string;
	password: string;
}): Promise<AuthTokenResponse> {
	return authRequest({
		operation: 'password_sign_in',
		path: 'token?grant_type=password',
		body: { email: input.email, password: input.password },
		validate: isAuthTokenResponse,
	});
}

export async function refreshAccessToken(input: {
	refreshToken: string;
}): Promise<AuthTokenResponse> {
	return authRequest({
		operation: 'refresh_session',
		path: 'token?grant_type=refresh_token',
		body: { refresh_token: input.refreshToken },
		validate: isAuthTokenResponse,
	});
}

export async function revokeAuthSessions(input: {
	accessToken: string;
	scope: 'global' | 'others';
}): Promise<void> {
	await authRequest({
		operation: 'sign_out',
		path: `logout?scope=${input.scope}`,
		authToken: input.accessToken,
		validate: (value): value is null => value === null,
	});
}

export interface MfaFactorRecord {
	id: string;
	status: string;
	factor_type: string;
	created_at?: string;
}

export interface MfaTotpEnrollment {
	id: string;
	qrCode: string;
	secret: string;
}

export interface MfaVerifiedSession {
	accessToken: string;
	refreshToken: string;
}

const isMfaFactorRecord = (value: unknown): value is MfaFactorRecord =>
	isRecord(value) &&
	typeof value.id === 'string' &&
	typeof value.status === 'string' &&
	typeof value.factor_type === 'string';

/** Lists the MFA factors of the account owning the (AAL1) access token. */
export async function listMfaFactors(accessToken: string): Promise<MfaFactorRecord[]> {
	const user = await authRequest({
		operation: 'mfa_list_factors',
		path: 'user',
		method: 'GET',
		authToken: accessToken,
		validate: isRecord,
	});
	const factors = Array.isArray(user.factors) ? user.factors : [];
	return factors.filter(isMfaFactorRecord);
}

export async function unenrollMfaFactor(accessToken: string, factorId: string): Promise<void> {
	await authRequest({
		operation: 'mfa_unenroll',
		path: `factors/${encodeURIComponent(factorId)}`,
		method: 'DELETE',
		authToken: accessToken,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars -- any body is acceptable here
		validate: (_value): _value is unknown => true,
	});
}

export async function enrollMfaTotp(accessToken: string): Promise<MfaTotpEnrollment> {
	const response = await authRequest({
		operation: 'mfa_enroll',
		path: 'factors',
		authToken: accessToken,
		body: { factor_type: 'totp' },
		validate: (value): value is Record<string, unknown> =>
			isRecord(value) &&
			typeof value.id === 'string' &&
			isRecord(value.totp) &&
			typeof value.totp.qr_code === 'string' &&
			typeof value.totp.secret === 'string',
	});
	const totp = response.totp as { qr_code: string; secret: string };
	return { id: response.id as string, qrCode: totp.qr_code, secret: totp.secret };
}

export async function challengeMfaFactor(accessToken: string, factorId: string): Promise<string> {
	const response = await authRequest({
		operation: 'mfa_challenge',
		path: `factors/${encodeURIComponent(factorId)}/challenge`,
		authToken: accessToken,
		body: {},
		validate: (value): value is { id: string } =>
			isRecord(value) && typeof value.id === 'string',
	});
	return response.id;
}

export async function verifyMfaFactor(input: {
	accessToken: string;
	factorId: string;
	challengeId: string;
	code: string;
}): Promise<MfaVerifiedSession> {
	const response = await authRequest({
		operation: 'mfa_verify',
		path: `factors/${encodeURIComponent(input.factorId)}/verify`,
		authToken: input.accessToken,
		body: { challenge_id: input.challengeId, code: input.code },
		validate: (value): value is { access_token: string; refresh_token: string } =>
			isRecord(value) &&
			typeof value.access_token === 'string' &&
			typeof value.refresh_token === 'string',
	});
	return { accessToken: response.access_token, refreshToken: response.refresh_token };
}

async function fetchAuthUsers(): Promise<AuthAdminUserRecord[]> {
	const response = await authRequest({
		operation: 'list_users',
		path: 'admin/users?page=1&per_page=1000',
		method: 'GET',
		useServiceRole: true,
		validate: isAuthUserListResponse,
	});
	return response.users;
}

export async function findAuthUserByEmail(input: { email: string }): Promise<AuthAdminUser | null> {
	const users = await fetchAuthUsers();
	const wanted = input.email.trim().toLowerCase();
	const user = users.find((item) => (item.email || '').trim().toLowerCase() === wanted);
	return user ? mapAuthAdminUser(user) : null;
}

export async function findAuthUserByLoginIdentifier(input: {
	identifier: string;
}): Promise<AuthAdminUser | null> {
	const users = await fetchAuthUsers();
	const wanted = input.identifier.trim().toLowerCase();
	const user = users.find((item) => {
		const mapped = mapAuthAdminUser(item);
		return (
			mapped.login_alias === wanted || (mapped.email || '').trim().toLowerCase() === wanted
		);
	});
	return user ? mapAuthAdminUser(user) : null;
}

export async function listAuthUsers(input?: {
	page?: number;
	perPage?: number;
}): Promise<AuthAdminUser[]> {
	const page = input?.page && input.page > 0 ? input.page : 1;
	const perPage = input?.perPage && input.perPage > 0 ? Math.min(input.perPage, 1000) : 200;
	const response = await authRequest({
		operation: 'list_users',
		path: `admin/users?page=${page}&per_page=${perPage}`,
		method: 'GET',
		useServiceRole: true,
		validate: isAuthUserListResponse,
	});
	return response.users.map(mapAuthAdminUser);
}

function extractAuthAdminUser(response: CreateAuthUserResponse): AuthAdminUserRecord {
	return 'user' in response ? response.user : response;
}

export async function createAuthUserByAdmin(input: {
	email: string;
	password: string;
	loginAlias?: string;
}): Promise<AuthAdminUser> {
	const response = await authRequest({
		operation: 'create_user_admin',
		path: 'admin/users',
		method: 'POST',
		useServiceRole: true,
		body: {
			email: input.email,
			password: input.password,
			email_confirm: true,
			user_metadata: input.loginAlias ? { login_alias: input.loginAlias } : undefined,
			app_metadata: {
				must_change_password: true,
				[TEMP_PASSWORD_EXPIRES_KEY]: buildTemporaryPasswordExpiry(),
			},
		},
		validate: isCreateAuthUserResponse,
	});
	return mapAuthAdminUser(extractAuthAdminUser(response));
}

export async function getAuthUserAdminById(userId: string): Promise<AuthAdminUserRecord> {
	return authRequest({
		operation: 'get_user_admin',
		path: `admin/users/${userId}`,
		method: 'GET',
		useServiceRole: true,
		validate: (value): value is AuthAdminUserRecord => hasStringId(value),
	});
}

async function updateAuthUserAdmin(input: {
	userId: string;
	password?: string;
	mustChangePassword: boolean;
	passwordResetOperationId?: string;
}): Promise<AuthAdminUser> {
	const existingUser = await getAuthUserAdminById(input.userId);
	const body: {
		password?: string;
		app_metadata: Record<string, unknown>;
		user_metadata?: Record<string, unknown>;
	} = {
		app_metadata: {
			...(existingUser.app_metadata || {}),
			must_change_password: input.mustChangePassword,
		},
	};
	if (input.password !== undefined) body.password = input.password;
	if (!input.mustChangePassword) {
		delete body.app_metadata[TEMP_PASSWORD_EXPIRES_KEY];
	} else if (input.password !== undefined) {
		body.app_metadata[TEMP_PASSWORD_EXPIRES_KEY] = buildTemporaryPasswordExpiry();
	}
	if (input.passwordResetOperationId) {
		body.user_metadata = {
			...(existingUser.user_metadata || {}),
			password_reset_operation_id: input.passwordResetOperationId,
		};
	}

	const response = await authRequest({
		operation: 'update_user_admin',
		path: `admin/users/${input.userId}`,
		method: 'PUT',
		useServiceRole: true,
		body,
		validate: isCreateAuthUserResponse,
	});
	return mapAuthAdminUser(extractAuthAdminUser(response));
}

export async function adminUpdateManagedLoginAlias(input: {
	userId: string;
	email: string;
	loginAlias: string;
	operationId?: string;
}): Promise<AuthAdminUser> {
	const existingUser = await getAuthUserAdminById(input.userId);
	const response = await authRequest({
		operation: 'update_user_admin',
		path: `admin/users/${input.userId}`,
		method: 'PUT',
		useServiceRole: true,
		body: {
			email: input.email,
			email_confirm: true,
			user_metadata: {
				...(existingUser.user_metadata || {}),
				login_alias: input.loginAlias,
				...(input.operationId ? { login_alias_operation_id: input.operationId } : {}),
			},
			app_metadata: { ...(existingUser.app_metadata || {}) },
		},
		validate: isCreateAuthUserResponse,
	});
	return mapAuthAdminUser(extractAuthAdminUser(response));
}

export async function adminResetAuthUserPassword(input: {
	userId: string;
	password: string;
	mustChangePassword?: boolean;
	operationId?: string;
}): Promise<AuthAdminUser> {
	return updateAuthUserAdmin({
		userId: input.userId,
		password: input.password,
		mustChangePassword: input.mustChangePassword ?? true,
		passwordResetOperationId: input.operationId,
	});
}

export async function updateUserPasswordUserAuth(input: {
	accessToken: string;
	password: string;
}): Promise<{ id: string; email?: string }> {
	return authRequest({
		operation: 'update_password',
		path: 'user',
		method: 'PUT',
		authToken: input.accessToken,
		body: { password: input.password },
		validate: (value): value is { id: string; email?: string } => hasStringId(value),
	});
}

export async function adminSetUserMustChangePassword(input: {
	userId: string;
	mustChangePassword: boolean;
}): Promise<AuthAdminUser> {
	return updateAuthUserAdmin({
		userId: input.userId,
		mustChangePassword: input.mustChangePassword,
	});
}
