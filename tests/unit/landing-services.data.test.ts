import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('landing services product value data', () => {
	it('frames Services as product value instead of event demo discovery', () => {
		const source = readFileSync(join(process.cwd(), 'src/data/landing-page.data.ts'), 'utf8');
		const servicesBlock = source.match(/\tservices: \{[\s\S]*?\n\t\},\n\tabout:/)?.[0] ?? '';
		const servicesItemsBlock = servicesBlock.match(/\t\titems: \[[\s\S]*?\n\t\t\],/)?.[0] ?? '';

		expect(source).toContain("secondaryCtaLabel: 'Ver demos'");
		expect(source).toContain("secondaryCtaUrl: '#tipo-evento'");
		expect(servicesBlock).toContain("title: 'Qué incluye tu invitación digital'");
		expect(servicesItemsBlock).toContain('items: [');
		expect(servicesItemsBlock.match(/\n\t\t\t\{/g) ?? []).toHaveLength(4);
		expect(servicesItemsBlock).not.toContain('href:');
		expect(servicesBlock).toContain("label: 'Solicitar asesoría'");
		expect(servicesBlock).toContain("href: '#contacto'");
	});
});
