import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ROOT = process.cwd();
const RULE = readFileSync(path.join(ROOT, '.agent', 'rules', 'board.md'), 'utf8');
const GUIDE = readFileSync(path.join(ROOT, 'docs', 'core', 'coordinator-board.md'), 'utf8');

/** The prompt template block of the coordinator guide. */
function template(): string {
	const m = /### Prompts \(d153\)[\s\S]*?```text\n([\s\S]*?)```/.exec(GUIDE);
	if (!m) throw new Error('coordinator-board.md has no prompt template');
	return m[1];
}

describe('board documents', () => {
	it('opens every prompt the same way in both documents', () => {
		expect(template().startsWith('T<n> · <título>\n')).toBe(true);
		expect(RULE).toContain('opening with `T<n> · <título>`');
		expect(RULE).not.toContain('Sigue .agent/rules/board.md');
	});

	it('keeps DECISIONES in every prompt, as the verifier requires (d046)', () => {
		// model.mjs refuses a prompt without '\nDECISIONES\n'; the template must pass that check.
		expect(template()).toContain('\nDECISIONES\n');
		expect(GUIDE).toContain('`DECISIONES` is always present (d046)');
		expect(GUIDE).not.toMatch(/Omit a section only when it has nothing to say/);
	});

	it('writes the shared rules once, in the board rule', () => {
		expect(RULE).toContain('## Working rules (every agent)');
		expect(RULE).toContain('**Cross review (d183)**');
		expect(RULE).toContain('**One board PR at a time (d184)**');
		expect(GUIDE).toContain('../../.agent/rules/board.md#working-rules-every-agent');
		for (const copied of [
			'### Common rules',
			'## Content rules',
			'uses SSE with 150 ms settling',
			'Keep successful archived prerequisites',
			'Retain an existing cross-review child',
			'runs finite read-only subprocess checks',
		])
			expect(GUIDE).not.toContain(copied);
	});

	it('leaves coordinator-only procedures in the coordinator guide', () => {
		expect(GUIDE).toContain('write `sesiones.json` in the board directory');
		expect(GUIDE).toContain('After a CLI writer crash');
		expect(RULE).not.toContain('obtains scoped recovery authority');
		expect(RULE).toContain('../../docs/core/coordinator-board.md#evidence-and-recovery');
	});
});
