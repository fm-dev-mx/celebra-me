/**
 * Pure Production mutation-boundary policy.
 *
 * Used by in-process spawn guards, Cursor hooks, and regression tests.
 * Does not spawn processes, write files, or call process.exit.
 */

import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

export const PRODUCTION_PROJECT_REF = SUPABASE_PROJECT_REFS.production;
export const AGENT_CONTEXT_ENV = 'CELEBRA_AGENT_CONTEXT';

export type BoundaryPermission = 'allow' | 'deny';

export interface BoundaryDecision {
	permission: BoundaryPermission;
	code?: string;
	message?: string;
	agentMessage?: string;
}

const MCP_READONLY_TOOLS = new Set([
	'search_docs',
	'list_organizations',
	'get_organization',
	'list_projects',
	'get_project',
	'get_cost',
	'list_tables',
	'list_extensions',
	'list_migrations',
	'query_logs',
	'get_advisors',
	'get_project_url',
	'get_publishable_keys',
	'generate_typescript_types',
	'list_edge_functions',
	'get_edge_function',
	'list_branches',
]);

const MCP_PRODUCTION_WRITE_TOOLS = new Set([
	'apply_migration',
	'deploy_edge_function',
	'create_project',
	'pause_project',
	'restore_project',
	'create_branch',
	'delete_branch',
	'merge_branch',
	'reset_branch',
	'rebase_branch',
	'execute_sql',
]);

const CANONICAL_OWNER_WORKFLOW =
	/\b(?:pnpm\s+(?:prod:apply|db:migrate|db:prod:patch|invitation:release|invitation:romina-draft-reset|invitation:draft-canonicalize|invitation:draft-restore)|scripts\/db\/(?:production-apply-cli|migrate-cli|run-prod-patch)\.ts|scripts\/provision\/(?:invitation-release-cli|romina-draft-reset-cli|draft-canonicalization-cli|draft-restore-cli)\.ts)\b/i;

const AGENT_CONTEXT_ASSIGNMENT =
	/(?:(?:^|[;&\r\n]\s*)(?:export\s+)?(?:\$env:)?|(?:^|[;&\r\n]\s*)\$env:)CELEBRA_AGENT_CONTEXT\s*=\s*(?:'[^']*'|"[^"]*"|\S+)\s*;?/gi;

function deny(code: string, message: string): BoundaryDecision {
	return {
		permission: 'deny',
		code,
		message,
		agentMessage: message,
	};
}

function allow(): BoundaryDecision {
	return { permission: 'allow' };
}

/**
 * Any presence of CELEBRA_AGENT_CONTEXT — including false, 0, or empty — is agent
 * context. Owner TTY processes leave the variable unset. Overrides cannot opt out.
 */
export function isAgentContext(env: NodeJS.ProcessEnv = process.env): boolean {
	return Object.prototype.hasOwnProperty.call(env, AGENT_CONTEXT_ENV);
}

function stripAgentContextAssignments(command: string): string {
	return command.replace(AGENT_CONTEXT_ASSIGNMENT, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Force agent Shell commands to CELEBRA_AGENT_CONTEXT=1.
 * Existing assignments (including false/0/empty) are stripped so they cannot win.
 */
export function wrapShellCommandWithAgentContext(command: string): string {
	const trimmed = command.trim();
	if (!trimmed) return command;
	const stripped = stripAgentContextAssignments(trimmed);
	if (!stripped) return `$env:${AGENT_CONTEXT_ENV}='1'`;
	return `$env:${AGENT_CONTEXT_ENV}='1'; ${stripped}`;
}

function commandHasApplyFlag(command: string): boolean {
	return /(?:^|[\s])--apply(?:[\s]|$)/.test(command);
}

function commandIsMigrateApplyWithoutSafeTarget(command: string): boolean {
	if (!/\b(?:db:migrate|migrate-cli)\b/i.test(command)) return false;
	if (/\bproduction\b/i.test(command)) return true;
	return !/\b(?:preview|local|disposable-test)\b/i.test(command);
}

const ALWAYS_PRODUCTION_APPLY = [
	/\bprod:apply\b/i,
	/\bproduction-apply-cli\b/i,
	/\bdb:prod:patch\b/i,
	/\brun-prod-patch\b/i,
	/\binvitation:romina-draft-reset\b/i,
	/\bromina-draft-reset-cli\b/i,
];

const PRODUCTION_TARGETED_APPLY = [
	/\binvitation:release\b/i,
	/\binvitation-release-cli\b/i,
	/\binvitation:draft-canonicalize\b/i,
	/\bdraft-canonicalization-cli\b/i,
	/\binvitation:draft-restore\b/i,
	/\bdraft-restore-cli\b/i,
];

/**
 * True when a Shell command would mutate Production through a maintained writer.
 * Preview/Local --apply is not Production apply.
 */
function commandIsProductionApply(command: string): boolean {
	const text = command.trim();
	if (!text || !commandHasApplyFlag(text)) return false;
	if (ALWAYS_PRODUCTION_APPLY.some((pattern) => pattern.test(text))) return true;
	if (commandIsMigrateApplyWithoutSafeTarget(text)) return true;
	if (!/\bproduction\b/i.test(text)) return false;
	return PRODUCTION_TARGETED_APPLY.some((pattern) => pattern.test(text));
}

function sqlDollarTagAt(sql: string, index: number): string | null {
	return sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0] ?? null;
}

function consumeSqlQuoted(sql: string, index: number): { text: string; nextIndex: number } {
	const quote = sql[index]!;
	let nextIndex = index + 1;
	while (nextIndex < sql.length) {
		if (sql[nextIndex] === '\\' && nextIndex + 1 < sql.length) {
			nextIndex += 2;
			continue;
		}
		if (sql[nextIndex] === quote) {
			if (sql[nextIndex + 1] === quote) {
				nextIndex += 2;
				continue;
			}
			nextIndex += 1;
			break;
		}
		nextIndex += 1;
	}
	return { text: sql.slice(index, nextIndex), nextIndex };
}

function consumeSqlDollarQuoted(
	sql: string,
	index: number,
	tag: string,
): { text: string; nextIndex: number } {
	const closing = sql.indexOf(tag, index + tag.length);
	const nextIndex = closing === -1 ? sql.length : closing + tag.length;
	return { text: sql.slice(index, nextIndex), nextIndex };
}

function consumeSqlComment(sql: string, index: number): { text: string; nextIndex: number } | null {
	if (sql[index] === '-' && sql[index + 1] === '-') {
		let nextIndex = index + 2;
		while (nextIndex < sql.length && sql[nextIndex] !== '\n' && sql[nextIndex] !== '\r') {
			nextIndex += 1;
		}
		return { text: ' '.repeat(nextIndex - index), nextIndex };
	}
	if (sql[index] === '/' && sql[index + 1] === '*') {
		const closing = sql.indexOf('*/', index + 2);
		const nextIndex = closing === -1 ? sql.length : closing + 2;
		return { text: ' '.repeat(nextIndex - index), nextIndex };
	}
	return null;
}

export function stripSqlComments(sql: string): string {
	let output = '';
	for (let i = 0; i < sql.length;) {
		const ch = sql[i]!;
		if (ch === "'" || ch === '"') {
			const segment = consumeSqlQuoted(sql, i);
			output += segment.text;
			i = segment.nextIndex;
			continue;
		}
		const dollar = sqlDollarTagAt(sql, i);
		if (dollar) {
			const segment = consumeSqlDollarQuoted(sql, i, dollar);
			output += segment.text;
			i = segment.nextIndex;
			continue;
		}
		const comment = consumeSqlComment(sql, i);
		if (comment) {
			output += comment.text;
			i = comment.nextIndex;
			continue;
		}
		output += ch;
		i += 1;
	}
	return output;
}

function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = '';
	let quote: "'" | '"' | null = null;
	let dollarTag: string | null = null;
	for (let i = 0; i < sql.length; i += 1) {
		const ch = sql[i]!;
		if (dollarTag) {
			current += ch;
			if (sql.startsWith(dollarTag, i)) {
				current += sql.slice(i + 1, i + dollarTag.length);
				i += dollarTag.length - 1;
				dollarTag = null;
			}
			continue;
		}
		if (quote) {
			current += ch;
			if (ch === '\\' && sql[i + 1] !== undefined) {
				current += sql[i + 1]!;
				i += 1;
				continue;
			}
			if (ch === quote) {
				if (sql[i + 1] === quote) {
					current += sql[i + 1]!;
					i += 1;
				} else {
					quote = null;
				}
			}
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			continue;
		}
		const dollar = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
		if (dollar) {
			dollarTag = dollar;
			current += dollar;
			i += dollar.length - 1;
			continue;
		}
		if (ch === ';') {
			statements.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	if (current.trim()) statements.push(current);
	return statements;
}

/** Replace literal contents with spaces before scanning executable SQL tokens. */
export function maskSqlLiterals(sql: string): string {
	let output = '';
	let quote: "'" | '"' | null = null;
	let dollarTag: string | null = null;
	for (let i = 0; i < sql.length; i += 1) {
		const ch = sql[i]!;
		if (dollarTag) {
			if (sql.startsWith(dollarTag, i)) {
				output += ' '.repeat(dollarTag.length);
				i += dollarTag.length - 1;
				dollarTag = null;
			} else {
				output += ' ';
			}
			continue;
		}
		if (quote) {
			if (ch === '\\' && sql[i + 1] !== undefined) {
				output += '  ';
				i += 1;
				continue;
			}
			if (ch === quote) {
				if (sql[i + 1] === quote) {
					output += '  ';
					i += 1;
				} else {
					output += ' ';
					quote = null;
				}
			} else {
				output += ' ';
			}
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			output += ' ';
			continue;
		}
		const dollar = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
		if (dollar) {
			dollarTag = dollar;
			output += ' '.repeat(dollar.length);
			i += dollar.length - 1;
			continue;
		}
		output += ch;
	}
	return output;
}

const SESSION_ONLY = /^(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|ABORT|END|SET|RESET|SHOW)\b/i;
const READ_HEAD = /^(SELECT|EXPLAIN|VALUES|TABLE|WITH)\b/i;
const WRITE_TOKEN =
	/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|VACUUM|REINDEX|CLUSTER|REFRESH\s+MATERIALIZED|LOCK|COPY|SECURITY|REASSIGN|DISCARD|LISTEN|NOTIFY|UNLISTEN|LOAD)\b/i;

export function isReadOnlySql(sql: string): boolean {
	const statements = splitSqlStatements(stripSqlComments(sql))
		.map((part) => part.trim())
		.filter(Boolean);
	if (statements.length === 0) return true;
	return statements.every((statement) => {
		const normalized = statement.replace(/^\(+/, '').trim();
		const executable = maskSqlLiterals(normalized);
		if (!normalized) return true;
		if (
			/^SET\s+(SESSION\s+)?AUTHORIZATION\b/i.test(executable) ||
			/^SET\s+ROLE\b/i.test(executable)
		) {
			return false;
		}
		if (SESSION_ONLY.test(executable)) return true;
		if (/^COPY\b/i.test(executable)) {
			// COPY TO STDOUT is a client export. Inner SELECT ... FROM must not look like COPY FROM.
			if (/\bFROM\s+(STDIN|PROGRAM)\b/i.test(executable)) return false;
			return /\bTO\s+STDOUT\b/i.test(executable);
		}
		if (!READ_HEAD.test(executable)) return false;
		if (/\bINTO\b/i.test(executable)) return false;
		if (/\bFOR\s+UPDATE\b/i.test(executable)) return false;
		if (WRITE_TOKEN.test(executable)) return false;
		return true;
	});
}

export function commandTargetsProduction(command: string): boolean {
	return (
		command.includes(PRODUCTION_PROJECT_REF) ||
		/\bPROD_DB_URL\b/.test(command) ||
		/\.env\.production\.local\b/.test(command) ||
		new RegExp(`db\\.${PRODUCTION_PROJECT_REF}\\.supabase\\.(?:co|com)`).test(command)
	);
}

function isCanonicalOwnerWorkflowCommand(command: string): boolean {
	return CANONICAL_OWNER_WORKFLOW.test(command);
}

function extractFlagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	return args[index + 1];
}

function extractPsqlTarget(args: readonly string[]): string | undefined {
	const dbname = extractFlagValue(args, '--dbname') ?? extractFlagValue(args, '-d');
	if (dbname) return dbname;
	for (const arg of args) {
		if (/^postgres(ql)?:\/\//i.test(arg)) return arg;
	}
	return undefined;
}

function extractPsqlSql(args: readonly string[], input?: string): string | undefined {
	const commandFlag = extractFlagValue(args, '-c') ?? extractFlagValue(args, '--command');
	if (commandFlag) return commandFlag;
	if (typeof input === 'string' && input.trim()) return input;
	return undefined;
}

export function isSupabaseMutatingPush(args: readonly string[]): boolean {
	const joined = args.join(' ');
	if (!/\bdb\s+push\b/.test(joined) && !(args.includes('db') && args.includes('push'))) {
		return false;
	}
	return !args.includes('--dry-run');
}

export function isSupabaseHistoryMutation(args: readonly string[]): boolean {
	if (isSupabaseMutatingPush(args)) return true;
	if (args.includes('migration') && args.includes('up')) return true;
	if (args.includes('db') && args.includes('reset')) return true;
	return false;
}

export interface SpawnInspection {
	kind: 'none' | 'supabase-mutation' | 'psql';
	dbUrl?: string;
	sql?: string;
	linked?: boolean;
}

export function inspectSpawn(
	command: string,
	args: readonly string[],
	options?: { input?: string },
): SpawnInspection {
	const base = command.replace(/\.exe$/i, '').toLowerCase();
	if (base === 'npx' && args[0] === 'supabase') {
		return inspectSpawn('supabase', args.slice(1), options);
	}
	if (base === 'supabase') {
		if (!isSupabaseHistoryMutation(args)) return { kind: 'none' };
		return {
			kind: 'supabase-mutation',
			dbUrl: extractFlagValue(args, '--db-url'),
			linked: args.includes('--linked'),
		};
	}
	if (base === 'psql') {
		return {
			kind: 'psql',
			dbUrl: extractPsqlTarget(args),
			sql: extractPsqlSql(args, options?.input),
		};
	}
	return { kind: 'none' };
}

function looksLikeProductionTarget(value: string | undefined): boolean {
	if (!value) return false;
	return commandTargetsProduction(value);
}

export function evaluateSpawnProductionMutation(
	command: string,
	args: readonly string[],
	options?: { input?: string },
): BoundaryDecision {
	const inspection = inspectSpawn(command, args, options);
	if (inspection.kind === 'none') return allow();

	if (inspection.kind === 'supabase-mutation') {
		if (inspection.linked) {
			return deny(
				'RAW_SUPABASE_LINKED_PUSH_BLOCKED',
				'Raw `supabase db push --linked` is blocked. Use `pnpm db:migrate` for schema changes.',
			);
		}
		if (!inspection.dbUrl) {
			return deny(
				'RAW_SUPABASE_PUSH_BLOCKED',
				'Unscoped `supabase db push` is blocked because it may target a linked remote. Use `pnpm db:migrate`.',
			);
		}
		if (!looksLikeProductionTarget(inspection.dbUrl)) return allow();
		return deny(
			'PRODUCTION_WRITE_PERMIT_REQUIRED',
			'Production schema push requires a canonical owner-authorized permit from `requireOwnerProductionApply`.',
		);
	}

	if (!looksLikeProductionTarget(inspection.dbUrl)) return allow();
	if (inspection.sql && isReadOnlySql(inspection.sql)) return allow();
	return deny(
		'PRODUCTION_WRITE_PERMIT_REQUIRED',
		'Production psql writes require a canonical owner-authorized permit from `requireOwnerProductionApply`.',
	);
}

function extractCommandSql(command: string): string | undefined {
	const commandMatch = command.match(/(?:-c|--command)\s+(['"])([\s\S]*?)\1/);
	if (commandMatch?.[2]) return commandMatch[2];
	const bare = command.match(/(?:-c|--command)\s+(\S+)/);
	return bare?.[1];
}

/**
 * Agent-session Shell evaluator. Denies canonical Production --apply before the
 * process starts. Read-only preflight/dry-run remains allowed.
 */
export function evaluateAgentShellProductionMutation(command: string): BoundaryDecision {
	const text = command.trim();
	if (!text) return allow();
	if (commandIsProductionApply(text)) {
		return deny(
			'AGENT_PRODUCTION_APPLY_BLOCKED',
			'Agents cannot mutate Production. Prepare and verify through Preview, then stop. The owner applies with `pnpm prod:apply` from an interactive owner terminal.',
		);
	}
	return evaluateShellProductionMutation(text);
}

export function evaluateShellProductionMutation(command: string): BoundaryDecision {
	const text = command.trim();
	if (!text) return allow();
	if (isCanonicalOwnerWorkflowCommand(text)) return allow();

	const isPush = /\bsupabase\b[\s\S]*\bdb\b[\s\S]*\bpush\b/i.test(text);
	const isMigrationUp = /\bsupabase\b[\s\S]*\bmigration\b[\s\S]*\bup\b/i.test(text);
	const isReset = /\bsupabase\b[\s\S]*\bdb\b[\s\S]*\breset\b/i.test(text);
	const isPsql = /(^|[\s;&|])psql\b/i.test(text);

	if (isPush && /--dry-run/.test(text)) return allow();

	if (isPush && /--linked/.test(text)) {
		return deny(
			'RAW_SUPABASE_LINKED_PUSH_BLOCKED',
			'Raw `supabase db push --linked` is blocked. Use `pnpm db:migrate`.',
		);
	}

	if (isPush && !/--db-url/.test(text) && !/--linked/.test(text)) {
		return deny(
			'RAW_SUPABASE_PUSH_BLOCKED',
			'Unscoped `supabase db push` is blocked because it may target a linked remote. Use `pnpm db:migrate`.',
		);
	}

	const targetsProduction = commandTargetsProduction(text);
	if (!targetsProduction) {
		if (isPush || isMigrationUp || isReset) {
			return deny(
				'RAW_SUPABASE_PUSH_BLOCKED',
				'Raw Supabase schema mutation CLI is blocked outside `pnpm db:migrate`.',
			);
		}
		return allow();
	}

	if (isPush || isMigrationUp || isReset) {
		return deny(
			'PRODUCTION_RAW_CLI_BLOCKED',
			'Raw Supabase CLI cannot mutate Production. Use `pnpm db:migrate -- --target production` with owner TTY authorization.',
		);
	}

	if (isPsql) {
		const sql = extractCommandSql(text);
		if (sql && isReadOnlySql(sql)) return allow();
		return deny(
			'PRODUCTION_RAW_PSQL_BLOCKED',
			'Raw psql cannot mutate Production. Use the canonical owner workflow. Read-only SELECT remains allowed.',
		);
	}

	return allow();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown> | null, keys: readonly string[]): string {
	if (!record) return '';
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return '';
}

export function extractMcpInvocation(payload: unknown): {
	toolName: string;
	projectId: string;
	sql: string;
} {
	const root = asRecord(payload) ?? {};
	const nested =
		asRecord(root.arguments) ??
		asRecord(root.args) ??
		asRecord(root.input) ??
		asRecord(root.tool_input) ??
		asRecord(root.parameters) ??
		asRecord(root.toolInput) ??
		{};
	const toolName = stringField(root, [
		'tool_name',
		'toolName',
		'tool',
		'mcp_tool_name',
		'mcpToolName',
	]).replace(/^.*\//, '');
	const projectId =
		stringField(nested, ['project_id', 'projectId', 'project']) ||
		stringField(root, ['project_id', 'projectId', 'project']);
	const sql =
		stringField(nested, ['query', 'sql', 'statement', 'contents']) ||
		stringField(root, ['query', 'sql', 'statement']);
	return { toolName, projectId, sql };
}

export function evaluateMcpProductionMutation(payload: unknown): BoundaryDecision {
	const { toolName, projectId, sql } = extractMcpInvocation(payload);
	const tool = toolName.toLowerCase();
	if (!tool) return allow();
	if (MCP_READONLY_TOOLS.has(tool)) return allow();
	if (!MCP_PRODUCTION_WRITE_TOOLS.has(tool)) return allow();

	const isProduction = !projectId || projectId === PRODUCTION_PROJECT_REF;
	if (!isProduction) return allow();

	if (tool === 'execute_sql') {
		if (!projectId) {
			return deny(
				'MCP_PRODUCTION_SQL_UNSCOPED',
				'Supabase MCP execute_sql without a project id is blocked because it may target Production.',
			);
		}
		if (sql && isReadOnlySql(sql)) return allow();
		return deny(
			'MCP_PRODUCTION_SQL_BLOCKED',
			'Supabase MCP cannot run mutating SQL against Production. Read-only SELECT is allowed. Schema changes must use `pnpm db:migrate -- --target production`.',
		);
	}

	return deny(
		'MCP_PRODUCTION_WRITE_BLOCKED',
		`Supabase MCP tool "${toolName}" cannot mutate Production. Use the canonical owner workflow.`,
	);
}

export function boundaryDecisionToHookOutput(decision: BoundaryDecision): {
	permission: BoundaryPermission;
	user_message?: string;
	agent_message?: string;
} {
	if (decision.permission === 'allow') return { permission: 'allow' };
	return {
		permission: 'deny',
		user_message: decision.message,
		agent_message: decision.agentMessage ?? decision.message,
	};
}
