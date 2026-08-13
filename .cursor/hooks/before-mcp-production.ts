/**
 * Cursor beforeMCPExecution: block Supabase MCP writes against Production.
 * Read-only Production MCP (list_migrations, SELECT execute_sql) remains allowed.
 */
import { readFileSync } from 'node:fs';
import {
	boundaryDecisionToHookOutput,
	evaluateMcpProductionMutation,
} from '../../scripts/db/production-boundary-policy.ts';

function readPayload(): unknown {
	try {
		return JSON.parse(readFileSync(0, 'utf8') || '{}');
	} catch {
		return {};
	}
}

const output = boundaryDecisionToHookOutput(evaluateMcpProductionMutation(readPayload()));
process.stdout.write(`${JSON.stringify(output)}\n`);
