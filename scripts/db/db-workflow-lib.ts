import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import {
	PROD_SECRET_FILES,
	LOCAL_DB_URL,
	redactDbUrl,
	parseDbUrl,
	getSecretFromEnvOrFiles,
} from './db-target-config.ts';

export * from './db-target-config.ts';

export const PROJECT_ROOT = process.cwd();
export const BASELINE_CUTOFF_VERSION = '20260715210600';
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
export const STORAGE_BUCKET_SIZE_LIMIT = 10_485_760;
export const REQUIRED_LOCAL_SUPER_ADMIN_EMAIL = 'celebra.me.com@gmail.com';
export const PSQL_REQUIRED_MESSAGE =
	'psql is required for local DB workflow scripts. Install PostgreSQL client tools and make sure `psql` is available on PATH. Verify with `psql --version`.';

export const REFRESH_PARITY_TABLES = [
	'invitations',
	'events',
	'published_invitation_content',
	'guest_invitations',
	'invitation_content_drafts',
	'intake_requests',
	'intake_submissions',
	'app_user_roles',
	'event_memberships',
	'event_claim_codes',
] as const;

export interface CommandResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

interface RunOptions {
	env?: NodeJS.ProcessEnv;
	input?: string;
	inherit?: boolean;
	redact?: string[];
	throwOnError?: boolean;
	/** Hard wall-clock timeout for spawnSync (ms). */
	timeoutMs?: number;
}

export function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function sqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function writeTextFile(filePath: string, content: string): void {
	ensureDir(dirname(filePath));
	writeFileSync(filePath, content, 'utf8');
}

export function parseTsv(output: string): string[][] {
	return output
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => line.split(/[|\t]/));
}

export function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

export function ensureDir(path: string): void {
	mkdirSync(path, { recursive: true });
}

export function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

export function parseEnvContent(content: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const separator = line.indexOf('=');
		if (separator <= 0) continue;
		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		const inlineComment = value.match(/^(.*?)(\s+#.*)$/);
		if (inlineComment) value = inlineComment[1]?.trim() ?? value;
		parsed[key] = value;
	}
	return parsed;
}

export function loadAppEnv(): Record<string, string> {
	const merged: Record<string, string> = {};
	for (const fileName of ['.env.local', '.env']) {
		const path = resolve(PROJECT_ROOT, fileName);
		if (!existsSync(path)) continue;
		const parsed = parseEnvContent(readFileSync(path, 'utf8'));
		for (const [key, value] of Object.entries(parsed)) {
			if (merged[key] === undefined) merged[key] = value;
		}
	}
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) merged[key] = value;
	}
	return merged;
}

export function getProdDbUrl(): { url: string; source: string } {
	const url = getSecretFromEnvOrFiles('PROD_DB_URL', PROD_SECRET_FILES);
	if (url) {
		const source = process.env.PROD_DB_URL?.trim()
			? 'environment variable PROD_DB_URL'
			: 'secret file';
		return { url, source };
	}

	fail(
		`PROD_DB_URL is required. Set it in the shell or one of these gitignored files: ${PROD_SECRET_FILES.join(
			', ',
		)}.`,
	);
}

export function assertProductionDbUrl(rawUrl: string): URL {
	const parsed = parseDbUrl(rawUrl);
	if (!parsed) {
		fail('PROD_DB_URL is not a valid postgres/postgresql URL.');
	}
	const host = parsed.hostname;
	const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
	const isSupabaseHost =
		host === 'supabase.co' ||
		host.endsWith('.supabase.co') ||
		host === 'supabase.com' ||
		host.endsWith('.supabase.com');

	if (isLocal || !isSupabaseHost) {
		fail(
			`Refusing PROD_DB_URL because host is not a Supabase production host. Redacted target: ${redactDbUrl(
				rawUrl,
			)}`,
		);
	}
	return new URL(rawUrl);
}

export function isLocalSupabaseUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return ['localhost', '127.0.0.1', '::1'].includes(host);
	} catch {
		return false;
	}
}

export function assertAppEnvIsLocal(appEnv = loadAppEnv()): void {
	const supabaseUrl = appEnv.SUPABASE_URL;
	const publicSupabaseUrl = appEnv.PUBLIC_SUPABASE_URL;
	if (supabaseUrl !== LOCAL_SUPABASE_URL || publicSupabaseUrl !== LOCAL_SUPABASE_URL) {
		fail(
			`Local DB workflow requires SUPABASE_URL and PUBLIC_SUPABASE_URL to be ${LOCAL_SUPABASE_URL}.`,
		);
	}
}

export function assertLocalApiReachable(apiUrl = LOCAL_SUPABASE_URL): void {
	const res = runCommand('curl.exe', ['--silent', '--fail', `${apiUrl}/rest/v1/`], {
		throwOnError: false,
	});
	if (res.status !== 0) {
		fail(
			`Local Supabase API is not reachable on ${apiUrl}. Run supabase status or supabase start.`,
		);
	}
}

export function assertLocalDbReachable(dbUrl = LOCAL_DB_URL): void {
	const versionCheck = runCommand('psql', ['--version'], { throwOnError: false });
	if (versionCheck.status !== 0) {
		fail(PSQL_REQUIRED_MESSAGE);
	}
	const res = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', dbUrl, '--command', 'select 1;'],
		{
			throwOnError: false,
			redact: [dbUrl],
		},
	);
	if (res.status !== 0) {
		fail(
			`Local Supabase DB is not reachable on ${redactDbUrl(dbUrl)}. Run supabase status or supabase start.`,
		);
	}
}

export function getFirstSuperAdminEmail(appEnv = loadAppEnv()): string {
	return (appEnv.SUPER_ADMIN_EMAILS ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
}

export function getLocalSuperAdminPassword(appEnv = loadAppEnv()): string {
	return appEnv.LOCAL_SUPER_ADMIN_PASSWORD || appEnv.RSVP_ADMIN_PASSWORD || '';
}

export function requireLocalSuperAdminConfig(appEnv = loadAppEnv()): {
	email: string;
	password: string;
} {
	const email = getFirstSuperAdminEmail(appEnv);
	if (email !== REQUIRED_LOCAL_SUPER_ADMIN_EMAIL) {
		fail(
			`Local admin bootstrap requires the first SUPER_ADMIN_EMAILS entry to be ${REQUIRED_LOCAL_SUPER_ADMIN_EMAIL}; got ${email || '<unset>'}.`,
		);
	}

	const password = getLocalSuperAdminPassword(appEnv);
	if (!password) {
		fail(
			'Local admin bootstrap requires LOCAL_SUPER_ADMIN_PASSWORD or RSVP_ADMIN_PASSWORD to be configured.',
		);
	}

	return { email, password };
}

export function assertNoProdCredentialsInLocalEnv(): void {
	const localEnvPath = resolve(PROJECT_ROOT, '.env.local');
	if (!existsSync(localEnvPath)) return;
	const parsed = parseEnvContent(readFileSync(localEnvPath, 'utf8'));
	const values = [parsed.PROD_DB_URL, parsed.SUPABASE_URL, parsed.PUBLIC_SUPABASE_URL].filter(
		Boolean,
	);
	const unsafe = values.some((value) => {
		try {
			const host = new URL(value as string).hostname.toLowerCase();
			return host.endsWith('.supabase.co') || host.endsWith('.supabase.com');
		} catch {
			return false;
		}
	});
	if (unsafe) {
		fail(
			'Refusing to run because .env.local contains remote Supabase credentials. Local DB workflows require Local Supabase URLs. Preview runtime credentials belong in .env.preview.local; Production credentials belong in shell or approved secret files — never in ordinary development-lane .env.local.',
		);
	}
}

export type AllowedShellCommand = 'npx' | 'supabase' | 'pnpm' | 'npm';

export const ALLOWED_SHELL_COMMANDS = new Set<string>(['npx', 'supabase', 'pnpm', 'npm']);

export function runCommand(
	command: string,
	args: string[],
	options: RunOptions = {},
): CommandResult {
	const { throwOnError = true } = options;
	const isShellCommand = ALLOWED_SHELL_COMMANDS.has(command);

	let cmdToSpawn = command;
	let argsToSpawn = args;
	let useShell = false;

	if (isShellCommand) {
		if (process.platform === 'win32') {
			cmdToSpawn = 'cmd.exe';
			argsToSpawn = ['/d', '/s', '/c', command, ...args];
		} else {
			useShell = true;
		}
	} else {
		useShell = false;
	}

	const spawnOptions: SpawnSyncOptions = {
		cwd: PROJECT_ROOT,
		env: { ...(options.env ?? process.env) },
		input: options.input,
		shell: useShell,
		encoding: 'utf8',
		stdio: options.inherit ? 'inherit' : 'pipe',
		...(typeof options.timeoutMs === 'number' && options.timeoutMs > 0
			? { timeout: options.timeoutMs, killSignal: 'SIGKILL' as const }
			: {}),
	};

	const result = spawnSync(cmdToSpawn, argsToSpawn, spawnOptions);
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';

	if (result.status !== 0 && throwOnError) {
		const fullCmd = `${command} ${args.join(' ')}`;
		const redactedCmd = options.redact
			? options.redact.reduce((cmd, secret) => cmd.replaceAll(secret, '<redacted>'), fullCmd)
			: fullCmd;
		const redactedStderr = options.redact
			? options.redact.reduce((err, secret) => err.replaceAll(secret, '<redacted>'), stderr)
			: stderr;
		fail(`Command failed (${result.status}): ${redactedCmd}\n${redactedStderr}`);
	}

	return {
		status: result.status,
		stdout,
		stderr,
	};
}

export function tryRunCommand(
	command: string,
	args: string[],
	options: RunOptions = {},
): CommandResult {
	return runCommand(command, args, { ...options, throwOnError: false });
}

export function runPsql(
	sqlOrFile: string,
	dbUrl?: string | (RunOptions & { isFile?: boolean; tuplesOnly?: boolean }),
	options?: (RunOptions & { isFile?: boolean; tuplesOnly?: boolean }) | string[],
): CommandResult {
	let targetUrl = LOCAL_DB_URL;
	let runOpts: RunOptions & { isFile?: boolean; tuplesOnly?: boolean } = {};

	if (typeof dbUrl === 'string') {
		targetUrl = dbUrl;
		if (Array.isArray(options)) {
			runOpts = { redact: options };
		} else if (options) {
			runOpts = options;
		}
	} else if (typeof dbUrl === 'object' && dbUrl !== null) {
		runOpts = dbUrl;
	}

	const args = ['--set', 'ON_ERROR_STOP=1'];
	if (runOpts.tuplesOnly !== false) {
		args.push('--tuples-only', '--no-align');
	}
	args.push('--dbname', targetUrl);
	let inputStr: string | undefined;

	if (runOpts.isFile) {
		args.push('--file', sqlOrFile);
	} else {
		inputStr = sqlOrFile;
	}

	return runCommand('psql', args, {
		...runOpts,
		input: inputStr,
		redact: [targetUrl, ...(runOpts.redact ?? [])],
	});
}

export function runPsqlFile(
	filePath: string,
	dbUrl: string = LOCAL_DB_URL,
	options: RunOptions = {},
): CommandResult {
	return runPsql(filePath, dbUrl, { ...options, isFile: true });
}

export function createProdBackup(
	prodUrl: string,
	backupPath?: string,
	schemaOnly?: boolean,
): string {
	const defaultDir = resolve(PROJECT_ROOT, '.backups', 'prod');
	ensureDir(defaultDir);
	const outputFile = backupPath || resolve(defaultDir, `prod-backup-${timestamp()}.sql`);
	const dumpArgs = ['--schema', 'public', '-f', outputFile];
	if (schemaOnly) {
		dumpArgs.push('--schema-only');
	} else {
		dumpArgs.push('--data-only');
	}
	dumpArgs.push('--dbname', prodUrl);

	const res = runCommand('pg_dump', dumpArgs, { redact: [prodUrl] });
	if (res.status !== 0) {
		fail('Production pre-migration backup failed.');
	}
	return outputFile;
}

export function getMissingTables(
	expectedTables: readonly string[],
	existingTables: string[],
): string[] {
	const existingSet = new Set(existingTables);
	return expectedTables.filter((t) => !existingSet.has(t));
}

export function ensureTablesExist(
	expectedTables: readonly string[],
	schema: string,
	dbUrl: string,
	label = 'target',
): void {
	const tableListSql = expectedTables.map((t) => sqlLiteral(t)).join(', ');
	const res = runPsql(
		`select table_name from information_schema.tables where table_schema = '${schema}' and table_name = any(array[${tableListSql}]);`,
		dbUrl,
	);
	const existing = res.stdout.trim().split(/\r?\n/).filter(Boolean);
	const missing = getMissingTables(expectedTables, existing);
	if (missing.length > 0) {
		fail(
			`Refresh parity table(s) ${missing.map((t) => `"${t}"`).join(', ')} not found in schema "${schema}" for ${label}.`,
		);
	}
}

export function transformDumpForStaging(dumpContent: string, stagingSchemaName: string): string {
	if (!dumpContent) return '';
	const lines = dumpContent.split('\n');
	let insideCopy = false;
	const result: string[] = [];

	for (const line of lines) {
		if (insideCopy) {
			result.push(line);
			if (line.trim() === '\\.') {
				insideCopy = false;
			}
			continue;
		}

		if (line.startsWith('COPY ')) {
			insideCopy = true;
			const transformed = line
				.replace(/^COPY public\./, `COPY ${stagingSchemaName}.`)
				.replace(/^COPY "public"\./, `COPY "${stagingSchemaName}".`);
			result.push(transformed);
			continue;
		}

		if (line.startsWith('SET search_path =')) {
			const transformed = line
				.replace(/search_path = "public"/, `search_path = ${stagingSchemaName}`)
				.replace(/search_path = public/, `search_path = ${stagingSchemaName}`);
			result.push(transformed);
			continue;
		}

		result.push(line);
	}

	return result.join('\n');
}

export interface ParityValidationOptions {
	sourceCounts: Record<string, number>;
	targetCounts: Record<string, number>;
	maxDeltas?: Record<string, number>;
}

export interface ParityFailure {
	table: string;
	sourceCount: number;
	targetCount: number;
	reason: 'count_mismatch';
}

export function validateRefreshParity(opts: ParityValidationOptions): {
	ok: boolean;
	failures: ParityFailure[];
} {
	const failures: ParityFailure[] = [];
	const maxDeltas = opts.maxDeltas ?? {};

	for (const [table, sourceCount] of Object.entries(opts.sourceCounts)) {
		const targetCount = opts.targetCounts[table] ?? 0;
		const maxDelta = maxDeltas[table] ?? 0;
		const delta = targetCount - sourceCount;

		if (delta < 0 || delta > maxDelta) {
			failures.push({
				table,
				sourceCount,
				targetCount,
				reason: 'count_mismatch',
			});
		}
	}

	return {
		ok: failures.length === 0,
		failures,
	};
}

export interface ProductionApprovalTokenPayload {
	operationType: string;
	targetEnv: 'production';
	scope: string;
	manifestFingerprint: string;
	operationId: string;
	expiresAt: number;
	nonce: string;
}

export interface ProductionApprovalToken {
	version: 1;
	algorithm: 'Ed25519';
	payload: ProductionApprovalTokenPayload;
	signature: string;
}

export interface ProductionApprovalConsumption {
	consumed: boolean;
	reason?: 'REPLAYED_APPROVAL' | 'REPLAY_LEDGER_UNAVAILABLE';
}

export type ProductionApprovalConsumer = (
	payload: ProductionApprovalTokenPayload,
) => ProductionApprovalConsumption;

export interface ProductionApprovalContext {
	operationType: string;
	targetEnv: 'production';
	scope: string;
	manifestFingerprint: string;
	operationId: string;
}

function approvalPayloadJson(payload: ProductionApprovalTokenPayload): string {
	return JSON.stringify({
		operationType: payload.operationType,
		targetEnv: payload.targetEnv,
		scope: payload.scope,
		manifestFingerprint: payload.manifestFingerprint,
		operationId: payload.operationId,
		expiresAt: payload.expiresAt,
		nonce: payload.nonce,
	});
}

export function deriveProductionOperationId(
	context: Omit<ProductionApprovalContext, 'operationId'>,
): string {
	return createHash('sha256')
		.update(
			[
				context.operationType,
				context.targetEnv,
				context.scope,
				context.manifestFingerprint,
			].join('\u001f'),
		)
		.digest('hex');
}

function parseProductionApprovalToken(tokenStr: string | undefined): {
	token?: ProductionApprovalToken;
	reason?: string;
} {
	if (!tokenStr || !tokenStr.trim()) return { reason: 'MISSING_APPROVAL_TOKEN' };
	try {
		const parsed = JSON.parse(
			Buffer.from(tokenStr.trim(), 'base64url').toString('utf8'),
		) as ProductionApprovalToken;
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			parsed.version !== 1 ||
			parsed.algorithm !== 'Ed25519' ||
			!parsed.payload ||
			typeof parsed.signature !== 'string'
		) {
			return { reason: 'MALFORMED_APPROVAL_TOKEN' };
		}
		return { token: parsed };
	} catch {
		return { reason: 'MALFORMED_APPROVAL_TOKEN' };
	}
}

function validProductionApprovalPayload(
	payload: ProductionApprovalTokenPayload,
	signature: string,
): boolean {
	const stringValues: unknown[] = [
		payload.operationType,
		payload.targetEnv,
		payload.scope,
		payload.manifestFingerprint,
		payload.operationId,
		payload.nonce,
		signature,
	];
	if (!stringValues.every((value) => typeof value === 'string' && value.trim().length > 0)) {
		return false;
	}
	return (
		typeof payload.expiresAt === 'number' &&
		Number.isFinite(payload.expiresAt) &&
		Number.isInteger(payload.expiresAt)
	);
}

function productionApprovalContextReason(
	payload: ProductionApprovalTokenPayload,
	expected: ProductionApprovalContext,
	now: number,
): string | undefined {
	if (payload.expiresAt <= now) return 'EXPIRED_APPROVAL_TOKEN';
	if (payload.targetEnv !== expected.targetEnv) return 'TARGET_ENV_MISMATCH';
	if (payload.operationType !== expected.operationType) return 'OPERATION_TYPE_MISMATCH';
	if (payload.scope !== expected.scope) return 'SCOPE_MISMATCH';
	if (payload.manifestFingerprint !== expected.manifestFingerprint) {
		return 'MANIFEST_FINGERPRINT_MISMATCH';
	}
	if (payload.operationId !== expected.operationId) return 'OPERATION_ID_MISMATCH';
	return undefined;
}

function validProductionApprovalSignature(
	payload: ProductionApprovalTokenPayload,
	signature: string,
	publicKeyText: string,
): boolean {
	try {
		const publicKey = createPublicKey(publicKeyText.trim());
		const signatureBytes = Buffer.from(signature, 'base64url');
		return (
			signatureBytes.length > 0 &&
			verify(
				null,
				Buffer.from(approvalPayloadJson(payload), 'utf8'),
				publicKey,
				signatureBytes,
			)
		);
	} catch {
		return false;
	}
}

export function verifyProductionApprovalToken(input: {
	tokenStr: string | undefined;
	publicKey: string | undefined;
	expectedContext: ProductionApprovalContext;
	nowMs?: number;
}): { valid: boolean; reason?: string } {
	if (!input.publicKey || !input.publicKey.trim()) {
		return { valid: false, reason: 'MISSING_OPERATOR_PUBLIC_KEY' };
	}
	const parsed = parseProductionApprovalToken(input.tokenStr);
	if (!parsed.token) return { valid: false, reason: parsed.reason };
	const { payload, signature } = parsed.token;
	if (!validProductionApprovalPayload(payload, signature)) {
		return { valid: false, reason: 'MALFORMED_APPROVAL_TOKEN' };
	}
	if (!validProductionApprovalSignature(payload, signature, input.publicKey)) {
		return { valid: false, reason: 'INVALID_SIGNATURE' };
	}
	const reason = productionApprovalContextReason(
		payload,
		input.expectedContext,
		input.nowMs ?? Date.now(),
	);
	return reason ? { valid: false, reason } : { valid: true };
}

export function consumeProductionApproval(input: {
	dbUrl: string;
	payload: ProductionApprovalTokenPayload;
}): ProductionApprovalConsumption {
	const result = runPsql(
		`INSERT INTO public.production_authorization_receipts (operation_id, nonce, operation_type, target_env, scope, manifest_fingerprint, expires_at)
         VALUES (${sqlLiteral(input.payload.operationId)}, ${sqlLiteral(input.payload.nonce)}, ${sqlLiteral(input.payload.operationType)}, ${sqlLiteral(input.payload.targetEnv)}, ${sqlLiteral(input.payload.scope)}, ${sqlLiteral(input.payload.manifestFingerprint)}, to_timestamp(${input.payload.expiresAt} / 1000.0))
         ON CONFLICT DO NOTHING
         RETURNING operation_id;`,
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (result.status !== 0) {
		return { consumed: false, reason: 'REPLAY_LEDGER_UNAVAILABLE' };
	}
	return result.stdout.trim()
		? { consumed: true }
		: { consumed: false, reason: 'REPLAYED_APPROVAL' };
}

interface ProductionConfirmationParams {
	operationType?: string;
	scope?: string;
	manifestFingerprint?: string;
	operationId?: string;
	consumeApproval?: ProductionApprovalConsumer;
}

function requireExternalProductionApproval(
	targetDescription: string,
	requiredConfirmation: string,
	params: ProductionConfirmationParams | undefined,
): { payload: ProductionApprovalTokenPayload; consume: ProductionApprovalConsumer } {
	const operationType = params?.operationType ?? 'production_migration';
	const scope = params?.scope ?? targetDescription;
	const manifestFingerprint = params?.manifestFingerprint ?? requiredConfirmation;
	const operationId =
		params?.operationId ??
		deriveProductionOperationId({
			operationType,
			targetEnv: 'production',
			scope,
			manifestFingerprint,
		});
	const verification = verifyProductionApprovalToken({
		tokenStr: process.env.CELEBRA_PROD_APPROVAL_TOKEN,
		publicKey: process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY,
		expectedContext: {
			operationType,
			targetEnv: 'production',
			scope,
			manifestFingerprint,
			operationId,
		},
	});
	if (!verification.valid) {
		fail(
			`PRODUCTION_AUTHORIZATION_FAILED [${verification.reason}]: Production action requires valid external Ed25519 operator approval evidence.`,
		);
	}
	const consume = params?.consumeApproval;
	if (!consume) {
		fail(
			'PRODUCTION_AUTHORIZATION_FAILED [REPLAY_LEDGER_REQUIRED]: Durable approval consumption is required before a Production write.',
		);
	}
	try {
		const parsed = JSON.parse(
			Buffer.from(
				process.env.CELEBRA_PROD_APPROVAL_TOKEN?.trim() ?? '',
				'base64url',
			).toString('utf8'),
		) as ProductionApprovalToken;
		return { payload: parsed.payload, consume };
	} catch {
		fail(
			'PRODUCTION_AUTHORIZATION_FAILED [MALFORMED_APPROVAL_TOKEN]: Token payload could not be read.',
		);
	}
}

export function confirmProductionActionSync(
	targetDescription: string,
	requiredConfirmation: string,
	params?: ProductionConfirmationParams,
): void {
	// Block autonomous agent self-authorization regardless of variables
	const agentContext = process.env.CELEBRA_AGENT_CONTEXT?.trim();
	if (agentContext && agentContext !== 'false' && agentContext !== '0') {
		fail(
			`AGENT_SELF_AUTHORIZATION_BLOCKED: Production actions require external operator approval evidence. ` +
				`Autonomous agents cannot self-authorize Production writes.`,
		);
	}

	if (
		process.env.CELEBRA_PROD_AUTH_SECRET?.trim() ||
		process.env.CELEBRA_PROD_APPROVAL_PRIVATE_KEY?.trim()
	) {
		fail(
			'PRODUCTION_AUTHORIZATION_FAILED [SELF_ISSUED_APPROVAL_REJECTED]: Signing material is not accepted in the production runtime.',
		);
	}

	const approval = requireExternalProductionApproval(
		targetDescription,
		requiredConfirmation,
		params,
	);
	const consumed = approval.consume(approval.payload);
	if (!consumed.consumed) {
		fail(
			`PRODUCTION_AUTHORIZATION_FAILED [${consumed.reason ?? 'REPLAYED_APPROVAL'}]: Approval was not durably consumed.`,
		);
	}
	console.info(
		`\n✅ External Production approval verified and consumed for ${targetDescription}.`,
	);
}

export async function confirmProductionAction(
	targetDescription: string,
	requiredConfirmation: string,
	params?: ProductionConfirmationParams,
): Promise<void> {
	confirmProductionActionSync(targetDescription, requiredConfirmation, params);
}

export function requireProductionConfirmationSync(
	targetDescription: string,
	requiredConfirmation?: string,
	params?: ProductionConfirmationParams,
): void {
	const confirmation = requiredConfirmation || `MIGRATE ${targetDescription}`;
	confirmProductionActionSync(targetDescription, confirmation, params);
}

export async function requireProductionConfirmation(
	targetDescription: string,
	requiredConfirmation?: string,
	params?: ProductionConfirmationParams,
): Promise<void> {
	requireProductionConfirmationSync(targetDescription, requiredConfirmation, params);
}
