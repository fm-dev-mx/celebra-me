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
	it('opens every prompt with the session name and ends it with METADATOS (prompt-v1)', () => {
		expect(template().startsWith('<carril> · T<n> · PR #<n> · <descripción breve>\n')).toBe(
			true,
		);
		expect(template().trimEnd().split('\n\n').at(-1)).toMatch(
			/^METADATOS\nformato: prompt-v1\n/,
		);
		expect(RULE).toContain('`<lane> · T<n> · PR #<n> · <description>`, then `PARA USTED`');
		expect(RULE).toContain('**Owner questions (d230)**');
		expect(RULE).toContain('**Inherited acceptance**');
		expect(RULE).not.toContain('Sigue .agent/rules/board.md');
	});

	it('lists the prompt-v1 sections in order and asks owner questions by board msg (d230)', () => {
		const headings = template()
			.split('\n')
			.filter((l) => /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{3,}$/.test(l));
		expect(headings).toEqual([
			'PARA USTED',
			'QUÉ SE BUSCA',
			'ANTES DE EMPEZAR',
			'PASOS',
			'AUTORIZO',
			'NO HAGAS',
			'DECISIONES',
			'PARE Y PREGUNTE SI',
			'AL TERMINAR',
			'METADATOS',
		]);
		expect(template()).toContain('--para=dueno');
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
		expect(RULE).toContain('**Board PRs (d270)**');
		expect(RULE).not.toContain('One board PR at a time (d184)');
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

	it('keeps the board rule operational and the internals in the coordinator guide', () => {
		// The rule is what every agent reads; view, SSE, sync and module detail live once in the guide.
		expect(RULE.split('\n').length).toBeLessThanOrEqual(200);
		expect(RULE).toContain('../../docs/core/coordinator-board.md#board-internals');
		expect(GUIDE).toContain('## Board internals');
		for (const moved of [
			'Layout (T268)',
			'The page uses SSE',
			'scripts/board/view-supervisor.mjs',
			'`model.mjs` owns every rule more than one script needs',
			'**Hygiene (d268)**',
			'Review prompts classify the complete PR file inventory',
		])
			expect(RULE).not.toContain(moved);
		for (const moved of [
			'Layout (T268)',
			'the page uses SSE',
			'scripts/board/view-supervisor.mjs',
			'`model.mjs` owns every rule more than one script needs',
			'**Hygiene (d268)**',
		])
			expect(GUIDE).toContain(moved);
	});

	it('lets the supervisor load new board code instead of a manual restart (d210)', () => {
		expect(RULE).toContain('**No manual restarts (d210)**');
		expect(GUIDE).toContain('A merge that changes the board needs no restart (d210)');
		expect(GUIDE).not.toContain('the owner restarts the server so it loads the');
	});
});
