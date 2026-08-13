/**
 * Inject CELEBRA_AGENT_CONTEXT=1 into agent Shell commands.
 * Attempted false/0/empty overrides are stripped so they cannot disable detection.
 */
import { readFileSync } from 'node:fs';
import { wrapShellCommandWithAgentContext } from '../../scripts/db/production-boundary-policy.ts';

function readPayload(): unknown {
	try {
		return JSON.parse(readFileSync(0, 'utf8') || '{}');
	} catch {
		return {};
	}
}

function extractCommand(payload: unknown): string {
	if (!payload || typeof payload !== 'object') return '';
	const record = payload as Record<string, unknown>;
	if (typeof record.command === 'string') return record.command;
	const toolInput = record.tool_input;
	if (
		toolInput &&
		typeof toolInput === 'object' &&
		typeof (toolInput as { command?: string }).command === 'string'
	) {
		return (toolInput as { command: string }).command;
	}
	const input = record.input;
	if (input && typeof input === 'object' && typeof (input as { command?: string }).command === 'string') {
		return (input as { command: string }).command;
	}
	return '';
}

const command = extractCommand(readPayload());
const wrapped = command ? wrapShellCommandWithAgentContext(command) : command;
const output =
	wrapped && wrapped !== command
		? { permission: 'allow', updated_input: { command: wrapped } }
		: { permission: 'allow' };

process.stdout.write(`${JSON.stringify(output)}\n`);
