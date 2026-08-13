import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

const ROOT = process.cwd();

function read(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Cursor Production mutation hooks', () => {
	it('registers fail-closed MCP and raw-CLI hooks plus agent-context injection', () => {
		const hooks = JSON.parse(read('.cursor/hooks.json')) as {
			hooks: Record<string, Array<{ command: string; failClosed?: boolean; matcher?: string }>>;
		};
		expect(hooks.hooks.beforeMCPExecution?.[0]?.failClosed).toBe(true);
		expect(hooks.hooks.beforeShellExecution?.[0]?.failClosed).toBe(true);
		expect(hooks.hooks.beforeShellExecution?.[0]?.command).toContain('before-shell-production');
		expect(hooks.hooks.beforeMCPExecution?.[0]?.command).toContain('before-mcp-production');
		expect(hooks.hooks.preToolUse?.[0]?.matcher).toBe('Shell');
		expect(hooks.hooks.sessionStart?.[0]?.command).toContain('session-start.mjs');
	});

	it('keeps hook policy aligned with the Production project ref', () => {
		const shellHook = read('.cursor/hooks/before-shell-production.ts');
		const mcpHook = read('.cursor/hooks/before-mcp-production.ts');
		const session = read('.cursor/hooks/session-start.mjs');
		const preTool = read('.cursor/hooks/pre-tool-use-agent-context.mjs');
		expect(shellHook).toContain('evaluateShellProductionMutation');
		expect(mcpHook).toContain('evaluateMcpProductionMutation');
		expect(session).toContain("CELEBRA_AGENT_CONTEXT: '1'");
		expect(preTool).toContain('CELEBRA_AGENT_CONTEXT');
		expect(read('.cursor/hooks.json')).toContain(SUPABASE_PROJECT_REFS.production);
		expect(read('scripts/db/production-boundary-policy.ts')).toContain('PRODUCTION_PROJECT_REF');
	});
});
