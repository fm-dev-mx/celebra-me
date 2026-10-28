#!/usr/bin/env node
/** Initialize and list tools only: never call a board tool or inspect host configuration. */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function checkMcp({
	entry = fileURLToPath(new URL('./mcp-server.mjs', import.meta.url)),
	timeout = 10_000,
} = {}) {
	const client = new Client({ name: 'celebra-board-check', version: '1.0.0' });
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [entry],
		cwd: fileURLToPath(new URL('../../', import.meta.url)),
		// SDK defaults inherit OS essentials, excluding credentials and NODE_OPTIONS.
		stderr: 'ignore',
	});
	try {
		await client.connect(transport, { timeout });
		const names = [];
		let cursor;
		do {
			const result = await client.listTools(cursor ? { cursor } : undefined, { timeout });
			names.push(...result.tools.map(({ name }) => name));
			cursor = result.nextCursor;
		} while (cursor);
		if (!names.length) throw new Error('empty tool list');
		return { ok: true, tools: names.sort() };
	} finally {
		await client.close();
		await transport.close();
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		console.log(JSON.stringify(await checkMcp()));
	} catch {
		console.error(
			'MCP no disponible: revise Node, pnpm install y scripts/board/mcp-server.mjs.',
		);
		process.exitCode = 1;
	}
}
