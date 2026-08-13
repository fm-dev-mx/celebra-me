#!/usr/bin/env node
/**
 * Mark this Cursor agent session so Production owner-apply rejects self-authorization.
 * Owner terminals are not wrapped by this hook.
 */
import { readFileSync } from 'node:fs';

let payload;
try {
	payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
	payload = {};
}

const output = {
	env: { CELEBRA_AGENT_CONTEXT: '1' },
	additional_context:
		'This is an agent session. CELEBRA_AGENT_CONTEXT=1. Production writes require the owner TTY workflow (`pnpm db:migrate -- --target production` or another requireOwnerProductionApply entry). Do not use Supabase MCP apply_migration / mutating execute_sql, raw `supabase db push`, or psql against Production.',
};

process.stdout.write(`${JSON.stringify(output)}\n`);
