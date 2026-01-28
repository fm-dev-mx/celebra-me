// tests/utils/pricingData.test.ts
import type { PricingData } from '@/interfaces/ui/sections/landing-page.interface';

describe('Pricing Data Structure Validation', () => {
	const sampleData: PricingData = {
		title: 'Planes',
		tiers: [
			{
				title: 'Básico',
				description: 'Desc',
				price: { amount: '100', currency: 'MXN', period: 'mes' },
				features: ['Feature 1'],
				cta: 'Elegir',
				href: '/path',
			},
			{
				title: 'Premium',
				description: 'Desc',
				price: { amount: '200', currency: 'MXN', period: 'mes' },
				features: ['Feature 1', 'Feature 2'],
				cta: 'Elegir Premium',
				href: '/path',
			},
			{
				title: 'Elite',
				description: 'Desc',
				price: { amount: 'Consultar', currency: '', period: '' },
				features: ['All'],
				cta: 'Contactar',
				href: '/contact',
				isElite: true,
			},
		],
	};

	it('should have a title', () => {
		expect(sampleData.title).toBeDefined();
	});

	it('should correctly identify the labels and flags', () => {
		const basic = sampleData.tiers.find((t) => t.title === 'Básico');
		const premium = sampleData.tiers.find((t) => t.title === 'Premium');
		const elite = sampleData.tiers.find((t) => t.title === 'Elite');

		expect(basic).toBeDefined();
		expect(premium).toBeDefined();
		expect(elite?.isElite).toBe(true);
	});

	it('should handle "Consultar" price correctly', () => {
		const elite = sampleData.tiers.find((t) => t.title === 'Elite');
		expect(elite?.price.amount).toBe('Consultar');
		expect(elite?.price.currency).toBe('');
	});
});
