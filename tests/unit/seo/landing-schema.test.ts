import { landingData } from '@/data/landing-page.data';
import { BRAND_ICONS } from '@/lib/brand/brand-logo';
import {
	buildLandingSchemaJsonLd,
	DEFAULT_SITE_ORIGIN,
	type SchemaFaqPage,
	type SchemaOrganization,
	type SchemaWebSite,
} from '@/lib/seo/landing-schema';

describe('landing schema JSON-LD', () => {
	const schema = buildLandingSchemaJsonLd();

	it('declares the Schema.org context and graph', () => {
		expect(schema['@context']).toBe('https://schema.org');
		expect(Array.isArray(schema['@graph'])).toBe(true);
		expect(schema['@graph']).toHaveLength(3);
	});

	it('includes a valid Organization node with essential properties', () => {
		const org = schema['@graph'].find(
			(node): node is SchemaOrganization => node['@type'] === 'Organization',
		);
		expect(org).toBeDefined();
		expect(org?.['@id']).toBe(`${DEFAULT_SITE_ORIGIN}/#organization`);
		expect(org?.name).toBe('Celebra-me');
		expect(org?.url).toBe(DEFAULT_SITE_ORIGIN);
		expect(org?.logo).toBe(`${DEFAULT_SITE_ORIGIN}${BRAND_ICONS.icon512}`);
		expect(org?.description).toBeTruthy();
	});

	it('includes a valid WebSite node', () => {
		const website = schema['@graph'].find(
			(node): node is SchemaWebSite => node['@type'] === 'WebSite',
		);
		expect(website).toBeDefined();
		expect(website?.['@id']).toBe(`${DEFAULT_SITE_ORIGIN}/#website`);
		expect(website?.url).toBe(DEFAULT_SITE_ORIGIN);
		expect(website?.publisher['@id']).toBe(`${DEFAULT_SITE_ORIGIN}/#organization`);
		expect(website?.inLanguage).toBe('es-MX');
	});

	it('includes a valid FAQPage node matching all FAQs in landingData', () => {
		const faqPage = schema['@graph'].find(
			(node): node is SchemaFaqPage => node['@type'] === 'FAQPage',
		);
		expect(faqPage).toBeDefined();
		expect(faqPage?.['@id']).toBe(`${DEFAULT_SITE_ORIGIN}/#faq`);
		expect(faqPage?.mainEntity).toHaveLength(landingData.faq.faqs.length);
		expect(landingData.faq.faqs.length).toBeGreaterThan(0);

		// Compare each FAQ question and answer 1:1 with JSON-LD
		landingData.faq.faqs.forEach((expectedFaq, index) => {
			const schemaItem = faqPage?.mainEntity[index];
			expect(schemaItem).toBeDefined();
			expect(schemaItem?.['@type']).toBe('Question');
			expect(schemaItem?.name).toBe(expectedFaq.question);
			expect(schemaItem?.acceptedAnswer['@type']).toBe('Answer');
			expect(schemaItem?.acceptedAnswer.text).toBe(expectedFaq.answer);

			// Assert validity: non-empty questions and answers
			expect(schemaItem?.name.trim().length).toBeGreaterThan(0);
			expect(schemaItem?.acceptedAnswer.text.trim().length).toBeGreaterThan(0);
		});
	});

	it('supports custom site origins', () => {
		const customOrigin = 'https://preview.celebra-me.com';
		const customSchema = buildLandingSchemaJsonLd(customOrigin);
		const org = customSchema['@graph'].find((n) => n['@type'] === 'Organization');
		expect(org?.url).toBe(customOrigin);
		expect(org?.['@id']).toBe(`${customOrigin}/#organization`);
	});
});
