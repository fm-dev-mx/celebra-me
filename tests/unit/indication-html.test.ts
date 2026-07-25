import { sanitizeIndicationHtml } from '@/lib/invitation/indication-html';

function renderIndication(value: string): HTMLElement {
	const element = document.createElement('p');
	element.innerHTML = sanitizeIndicationHtml(value);
	return element;
}

describe('sanitizeIndicationHtml', () => {
	it('preserves the supported emphasis and line-break formatting', () => {
		const rendered = renderIndication('Llegar <strong>puntuales</strong>\nGracias');

		expect(rendered.innerHTML).toBe('Llegar <strong>puntuales</strong><br>Gracias');
		expect(rendered.textContent).toBe('Llegar puntualesGracias');
		expect(rendered.querySelectorAll('strong')).toHaveLength(1);
		expect(rendered.querySelectorAll('br')).toHaveLength(1);
	});

	it.each([
		'<script>window.__xss = true</script>',
		'<img src=x onerror="window.__xss = true">',
		'<strong onclick="window.__xss = true">Texto</strong>',
		'&lt;img src=x onerror=window.__xss=true&gt;',
		'<div><strong>Texto</strong><iframe src="https://attacker.example"></iframe></div>',
		'<svg onload="window.__xss = true"><circle r="1"></circle></svg>',
		'<!-- comment --><strong>ok</strong>',
		'<style>body{display:none}</style><strong>ok</strong>',
		'<a href="javascript:alert(1)">link</a>',
		'<math><mi>x</mi></math>',
	])('removes executable or unsupported markup from %s', (payload) => {
		const rendered = renderIndication(payload);

		expect(rendered.querySelectorAll('script, img, iframe, svg, style, math, a')).toHaveLength(
			0,
		);
		expect(
			rendered.querySelectorAll('[onerror], [onclick], [onload], [href^="javascript:"]'),
		).toHaveLength(0);
	});

	it('keeps plain text from malformed nested tags without restoring disallowed elements', () => {
		const rendered = renderIndication('<div><em>no</em><strong>sí</strong></div>');

		expect(rendered.querySelectorAll('div, em')).toHaveLength(0);
		expect(rendered.querySelectorAll('strong')).toHaveLength(1);
		expect(rendered.textContent).toContain('sí');
	});
});
