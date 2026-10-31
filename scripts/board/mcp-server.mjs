#!/usr/bin/env node
/** Stdio adapter: the board CLI remains the sole owner of board behavior and validation. */
import { execFile } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AGENT_REGISTRY, ATENDIBLES, DESTINOS, NIVELES, VEREDICTOS } from './model.mjs';
import { boardDir } from './store.mjs';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('./board.mjs', import.meta.url));
const AGENTS = Object.keys(AGENT_REGISTRY);
/** One JSONL file per UTC day of MCP calls, beside the bitácora; it never holds message text. */
export const MCP_LOG_DIR = 'mcp';
const text = z.string().min(1);
const base = {
	agente: z.enum(AGENTS),
	sesion: text
		.optional()
		.describe('Current host session ID; required for Codex/Gemini lock ownership.'),
};
const task = { id: text.regex(/^(?:[a-z0-9][a-z0-9-]*|T\d+)$/) };
const revision = { rev: z.number().int().positive() };
const uncheckedRevision = {
	rev: revision.rev
		.optional()
		.describe('Ignored by this CLI command; no revision check is performed.'),
};
const lines = z.array(text).min(1);
const safety = z.enum(['commit', 'history', 'commit,history']);
const tools = {
	next: {
		description:
			'Return the next eligible task, or blocked tasks with reasons when none is eligible.',
		fields: {},
	},
	show: { description: 'Read one task and its current revision.', fields: task },
	list: { description: 'List the current agent queue.', fields: {} },
	claim: {
		description: 'Claim a task from its assigned lane and branch; start Git Safety.',
		fields: {
			...task,
			...uncheckedRevision,
			carril: text.optional(),
			rama: text.optional(),
			titulo: text,
		},
	},
	release: {
		description: 'Release a lock owned by this agent and session.',
		fields: { ...task, ...uncheckedRevision, 'git-safety': safety.optional() },
	},
	msg: {
		description: 'Send a task message as the explicit calling agent.',
		fields: {
			...task,
			...uncheckedRevision,
			texto: text,
			para: z.enum(DESTINOS),
			opcion: lines.optional(),
			detalle: text.optional(),
		},
	},
	inbox: {
		description: 'Read this agent inbox and mark its messages read.',
		fields: { todos: z.boolean().optional() },
	},
	atendido: {
		description: 'Mark answered owner/coordinator messages handled under existing CLI guards.',
		fields: {
			...task,
			...uncheckedRevision,
			para: z.enum(ATENDIBLES),
			mensaje: text.optional(),
			nota: text.optional(),
		},
	},
	sigue: { description: 'Read owner/coordinator next actions and stalled tasks.', fields: {} },
	close: {
		description: 'Write the handoff for a task owned by this agent and session.',
		fields: {
			...task,
			...revision,
			resumen: lines.optional(),
			comprobacion: lines.optional(),
			saltada: lines.optional(),
			pendiente: lines.optional(),
			fallida: lines.optional(),
			riesgo: lines.optional(),
			duda: lines.optional(),
			excepcion: lines.optional(),
			pr: text.optional(),
			sha: text.optional(),
			commit: text.optional(),
			nivel: z.enum(NIVELES).optional(),
			veredicto: z.enum(VEREDICTOS).optional(),
			hallazgo: lines.optional(),
			changelog: text.optional(),
			'git-safety': safety.optional(),
		},
	},
};

const listFields = new Set(
	Object.values(tools).flatMap(({ fields }) =>
		Object.entries(fields)
			.filter(([, field]) => field === lines || field.unwrap?.() === lines)
			.map(([key]) => key),
	),
);

/** An empty list means «nothing to report», the same as leaving the field out. */
function withoutEmptyLists(args) {
	if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
	return Object.fromEntries(
		Object.entries(args).filter(
			([key, value]) => !(listFields.has(key) && Array.isArray(value) && !value.length),
		),
	);
}

function agentProblem(args) {
	const choices = AGENTS.map((a) => `"${a}"`)
		.join(', ')
		.replace(/, ([^,]*)$/, ' o $1');
	if (args?.agente === undefined) return `Falta \`agente\`: envíe ${choices}.`;
	if (!AGENTS.includes(args.agente))
		return `\`agente\` no válido (${JSON.stringify(args.agente)}): envíe ${choices}.`;
	return null;
}

/** Append one call summary to <board>/mcp/<day>.jsonl; logging never fails the call. */
function mcpLogger() {
	let dir;
	return (row) => {
		try {
			dir ??= join(boardDir(), MCP_LOG_DIR);
			mkdirSync(dir, { recursive: true });
			appendFileSync(join(dir, `${row.en.slice(0, 10)}.jsonl`), `${JSON.stringify(row)}\n`);
		} catch {
			// The store may be unreachable (no Git checkout); the call result still goes back.
		}
	};
}

function cliFailure(error) {
	try {
		const { error: message, codigo } = JSON.parse(error.stdout);
		return { codigo, error: message };
	} catch {
		return { codigo: error.code ?? 1, error: String(error.stderr || error.message).trim() };
	}
}

export function createServer({ cliTimeoutMs = 120_000 } = {}) {
	const server = new McpServer({ name: 'celebra-board', version: '1.0.0' });
	const log = mcpLogger();
	const record = (herramienta, args, started, result) =>
		log({
			en: new Date(started).toISOString(),
			herramienta,
			agente: typeof args?.agente === 'string' ? args.agente : null,
			tarea: typeof args?.id === 'string' ? args.id : null,
			ms: Date.now() - started,
			...result,
			...(result.error ? { error: String(result.error).slice(0, 500) } : {}),
		});
	// The SDK validates arguments before any handler runs; wrap that step so refusals are logged
	// and explained too.
	if (typeof server.validateToolInput !== 'function')
		throw new Error('MCP SDK changed: McpServer.validateToolInput is missing');
	const validate = server.validateToolInput.bind(server);
	server.validateToolInput = async (tool, args, toolName) => {
		const started = Date.now();
		const input = withoutEmptyLists(args);
		try {
			const problem = agentProblem(input);
			if (problem) throw new Error(problem);
			return await validate(tool, input, toolName);
		} catch (error) {
			record(toolName, input, started, {
				ok: false,
				codigo: 'validacion',
				error: error.message,
			});
			throw error;
		}
	};
	for (const [name, { description, fields }] of Object.entries(tools)) {
		const schema = z.strictObject({ ...base, ...fields });
		server.registerTool(name, { description, inputSchema: schema }, async (input) => {
			const started = Date.now();
			const result = await callCli(name, schema, input, cliTimeoutMs);
			record(name, input, started, result.log);
			return result.reply;
		});
	}
	return server;
}

/** Run one board command; `log` is the call summary for the MCP log, without message text. */
async function callCli(name, schema, input, cliTimeoutMs) {
	// Validate here too: unknown flags must never become CLI coordinator privileges.
	const { id, ...flags } = schema.parse(input);
	const args = [cli, name, ...(id ? [id] : []), '--json'];
	for (const [key, value] of Object.entries({
		...flags,
		quien: flags.agente,
		...(name === 'msg' ? { de: flags.agente } : {}),
	})) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== undefined && item !== false)
				args.push(item === true ? `--${key}` : `--${key}=${item}`);
		}
	}
	const failed = (text, log) => ({
		reply: { isError: true, content: [{ type: 'text', text }] },
		log: { ok: false, ...log },
	});
	try {
		const { stdout } = await execute(process.execPath, args, {
			env: { ...process.env, CELEBRA_BOARD_VIA: 'mcp' },
			maxBuffer: 16 * 1024 * 1024,
			timeout: cliTimeoutMs,
		});
		// Return the CLI JSON verbatim: arrays and null are valid board responses too.
		JSON.parse(stdout);
		return {
			reply: { content: [{ type: 'text', text: stdout.trimEnd() }] },
			log: { ok: true, codigo: 0 },
		};
	} catch (error) {
		if (error.killed && error.signal === 'SIGTERM') {
			const text = `Board CLI timed out after ${cliTimeoutMs} ms (${name}); it may have saved changes. Read the task before retrying.`;
			return failed(text, { codigo: 'tiempo', error: text });
		}
		const detail =
			typeof error.stdout === 'string' && error.stdout.trim()
				? error.stdout.trimEnd()
				: String(error.stderr || error.message).trim();
		return failed(detail, cliFailure(error));
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await createServer().connect(new StdioServerTransport());
}
