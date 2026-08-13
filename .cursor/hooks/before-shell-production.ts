/**
 * Cursor beforeShellExecution: block raw Production schema/data mutation CLIs.
 */
import { readFileSync } from 'node:fs';
import {
	boundaryDecisionToHookOutput,
	evaluateShellProductionMutation,
} from '../../scripts/db/production-boundary-policy.ts';

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
	const input = record.input;
	if (input && typeof input === 'object' && typeof (input as { command?: string }).command === 'string') {
		return (input as { command: string }).command;
	}
	return '';
}

const command = extractCommand(readPayload());
const output = boundaryDecisionToHookOutput(evaluateShellProductionMutation(command));
process.stdout.write(`${JSON.stringify(output)}\n`);
