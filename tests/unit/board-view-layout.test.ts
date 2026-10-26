import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const VIEW = readFileSync(path.join(process.cwd(), 'scripts', 'board', 'view.html'), 'utf8');
const CSS = /<style>([\s\S]*?)<\/style>/.exec(VIEW)?.[1] ?? '';
const SCRIPT = /<script type="module">([\s\S]*?)<\/script>/.exec(VIEW)?.[1] ?? '';

/** The custom properties of one `:root…{…}` block, resolved one level of `var()`. */
function tokens(selector: string): Record<string, string> {
	const at = CSS.indexOf(selector);
	expect(at).toBeGreaterThanOrEqual(0);
	const body = CSS.slice(CSS.indexOf('{', at + selector.length - 1) + 1, CSS.indexOf('}', at));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/--([\w-]+):([^;]+);?/g)) out[m[1]] = m[2].trim();
	return out;
}
const luminance = (hex: string) => {
	const c = (hex.match(/\w\w/g) ?? []).map((x) => parseInt(x, 16) / 255);
	const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

describe('board view layout (T268)', () => {
	it('puts every view in a left sidebar, «Para usted» first and by default', () => {
		const tabs = [...VIEW.matchAll(/data-tab="([a-z]+)" id="t-/g)].map((x) => x[1]);
		expect(tabs).toEqual([
			'usted',
			'cola',
			'calendario',
			'bloqueadas',
			'finalizadas',
			'carriles',
			'historial',
		]);
		expect(VIEW).toMatch(
			/<aside class="side" id="side"[\s\S]*<nav class="tabs" role="tablist"/,
		);
		expect(VIEW).toMatch(/<div class="side-foot">\s*<div class="strip" id="strip">/);
		expect(SCRIPT).toContain("tab:'usted'");
		expect(SCRIPT).toContain("S.tab=TABS.includes(tab)?tab:'usted';");
		// Below 800px the sidebar slides over the page behind a menu button.
		expect(CSS).toMatch(
			/@media \(max-width:799px\)\{[\s\S]*?body\.side-open \.side\{transform:none/,
		);
	});

	it('lists only the owner actions in «Para usted»; the other boxes are Cola groups', () => {
		const usted = /<section id="p-usted"[\s\S]*?<\/section>/.exec(VIEW)?.[0] ?? '';
		expect(usted).toContain('id="mine"');
		expect(usted).not.toContain('id="coord"');
		expect(usted).not.toContain('id="stall"');
		const cola = /<section id="p-cola"[\s\S]*?<\/section>/.exec(VIEW)?.[0] ?? '';
		expect(cola).toMatch(
			/<details class="grpd" data-fold="coord"[^>]*>.*Le toca al coordinador/,
		);
		expect(cola).toMatch(/<details class="grpd" data-fold="stall"[^>]*>.*Detenidas/);
		expect(VIEW).not.toContain('class="whats"');
		expect(VIEW).not.toContain('class="legend"');
		expect(SCRIPT).not.toContain('youBtn');
	});

	it('turns the legend and the agent chips into filters inside the Cola', () => {
		for (const c of ['todos', 'own', 'auto', 'run', 'block', 'rev'])
			expect(VIEW).toContain(`data-col="${c}"`);
		expect(SCRIPT).toContain("const colorOk=t=>S.col==='todos'||color(t)===S.col;");
		expect(SCRIPT).toContain('&&found(t)&&colorOk(t));');
	});

	it('keeps rows compact, groups collapsible and Ctrl+K on the search', () => {
		expect(SCRIPT).toContain(
			'<button type="button" class="btn sm hov" data-copy="${esc(t.id)}">Copiar prompt</button>',
		);
		expect(SCRIPT).not.toContain('class="why"');
		expect(SCRIPT).toContain("foldHtml('q-revision','En revisión'");
		expect(SCRIPT).toContain("localStorage.setItem('board-fold'");
		expect(SCRIPT).toMatch(
			/\(ev\.ctrlKey\|\|ev\.metaKey\)&&!ev\.altKey&&ev\.key\.toLowerCase\(\)==='k'/,
		);
		// No colored rule on the left of a row or chip.
		expect(CSS).not.toMatch(/inset 3px 0 0/);
		expect(CSS).not.toMatch(/border-left:3px/);
	});

	it('marks urgency with the row ring, never green', () => {
		const rings = [...CSS.matchAll(/\.ring\.r-[a-z]+\{([^}]*)\}/g)].map((m) => m[1]);
		expect(rings.length).toBeGreaterThanOrEqual(3);
		for (const r of rings) expect(r).not.toMatch(/--own/);
	});

	it('uses the neutral palette and passes WCAG AA in both themes', () => {
		const light = tokens(':root{');
		const dark = tokens(':root[data-theme="dark"]{');
		expect(light).toMatchObject({ bg: '#fbfbfa', ink: '#37352f', line: '#edece9' });
		expect(dark).toMatchObject({ bg: '#191919', panel: '#202020', ink: '#e3e2e0' });
		for (const t of [light, dark]) {
			for (const fg of ['ink', 'muted', 'faint', 'accent'])
				for (const bg of ['bg', 'panel', 'side'])
					expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
			for (const s of ['own', 'auto', 'block', 'run', 'rev', 'warn', 'danger']) {
				expect(contrast(t[s], t[`${s}-soft`])).toBeGreaterThanOrEqual(4.5);
				expect(contrast(t[s], t.panel)).toBeGreaterThanOrEqual(4.5);
			}
		}
		// The dark block under prefers-color-scheme matches the explicit dark theme.
		const auto = tokens(':root:not([data-theme="light"]){');
		expect(auto).toEqual(dark);
	});
});
