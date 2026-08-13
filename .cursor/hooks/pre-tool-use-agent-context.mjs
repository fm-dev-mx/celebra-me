#!/usr/bin/env node
/**
 * Inject CELEBRA_AGENT_CONTEXT into agent Shell commands (PowerShell).
 */
import { readFileSync } from 'node:fs';

let payload;
try {
	payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
	payload = {};
}

const record = payload && typeof payload === 'object' ? payload : {};
const command =
	typeof record.command === 'string'
		? record.command
		: typeof record.tool_input?.command === 'string'
			? record.tool_input.command
			: typeof record.input?.command === 'string'
				? record.input.command
				: '';

const alreadySet = /(?:^|[;\s]|\$env:)CELEBRA_AGENT_CONTEXT\s*=/.test(command);
const wrapped =
	command && !alreadySet ? `$env:CELEBRA_AGENT_CONTEXT='1'; ${command}` : command;

const output =
	wrapped && wrapped !== command
		? { permission: 'allow', updated_input: { command: wrapped } }
		: { permission: 'allow' };

process.stdout.write(`${JSON.stringify(output)}\n`);
