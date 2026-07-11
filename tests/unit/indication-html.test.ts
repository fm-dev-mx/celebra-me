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
	])('removes executable markup from %s', (payload) => {
		const rendered = renderIndication(payload);

		expect(rendered.querySelectorAll('script, img, iframe')).toHaveLength(0);
		expect(rendered.querySelectorAll('[onerror], [onclick], [href^="javascript:"]')).toHaveLength(0);
	});
});
