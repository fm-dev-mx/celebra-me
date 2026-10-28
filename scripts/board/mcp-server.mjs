#!/usr/bin/env node
/** Stdio adapter: the board CLI remains the sole owner of board behavior and validation. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('./board.mjs', import.meta.url));
const text = z.string().min(1);
const base = {
	agente: z.enum(['claude', 'codex', 'gemini']),
	sesion: text
		.optional()
		.describe('Current host session ID; required for Codex/Gemini lock ownership.'),
};
const task = { id: text.regex(/^(?:[a-z0-9][a-z0-9-]*|T\d+)$/) };
const revision = { rev: z.number().int().positive() };
const lines = z.array(text).min(1);
const safety = z.enum(['commit', 'history', 'commit,history']);
const tools = {
	next: { description: 'Return the next eligible task, including delivery guards.', fields: {} },
	show: { description: 'Read one task and its current revision.', fields: task },
	list: { description: 'List the current agent queue.', fields: {} },
	claim: {
		description: 'Claim a task from its assigned lane and branch; start Git Safety.',
		fields: {
			...task,
			...revision,
			carril: text.optional(),
			rama: text.optional(),
			titulo: text,
		},
	},
	release: {
		description: 'Release a lock owned by this agent and session.',
		fields: { ...task, ...revision, 'git-safety': safety.optional() },
	},
	msg: {
		description: 'Send a task message as the explicit calling agent.',
		fields: {
			...task,
			...revision,
			texto: text,
			para: z.enum(['claude', 'codex', 'gemini', 'dueno', 'coordinador']),
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
			...revision,
			para: z.enum(['dueno', 'coordinador']),
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
			resumen: lines,
			comprobacion: lines,
			saltada: lines,
			pendiente: lines,
			fallida: lines,
			riesgo: lines,
			duda: lines,
			excepcion: lines,
			pr: text.optional(),
			sha: text.optional(),
			commit: text.optional(),
			nivel: z.enum(['validate:changed', 'type-check', 'ci']).optional(),
			veredicto: z.enum(['aprobado', 'cambios', 'bloqueado']).optional(),
			hallazgo: lines.optional(),
			changelog: text,
			'git-safety': safety.optional(),
		},
	},
};

export function createServer() {
	const server = new McpServer({ name: 'celebra-board', version: '1.0.0' });
	for (const [name, { description, fields }] of Object.entries(tools)) {
		const schema = z.strictObject({ ...base, ...fields });
		server.registerTool(name, { description, inputSchema: schema }, async (input) => {
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
			try {
				const { stdout } = await execute(process.execPath, args, {
					maxBuffer: 16 * 1024 * 1024,
				});
				// Return the CLI JSON verbatim: arrays and null are valid board responses too.
				JSON.parse(stdout);
				return { content: [{ type: 'text', text: stdout.trimEnd() }] };
			} catch (error) {
				const detail =
					typeof error.stdout === 'string' && error.stdout.trim()
						? error.stdout.trimEnd()
						: String(error.stderr || error.message).trim();
				return { isError: true, content: [{ type: 'text', text: detail }] };
			}
		});
	}
	return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await createServer().connect(new StdioServerTransport());
}
