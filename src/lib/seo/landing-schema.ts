import { landingData } from '@/data/landing-page.data';

export const DEFAULT_SITE_ORIGIN = 'https://www.celebra-me.com';

export interface SchemaQuestion {
	'@type': 'Question';
	name: string;
	acceptedAnswer: {
		'@type': 'Answer';
		text: string;
	};
}

export interface SchemaFaqPage {
	'@type': 'FAQPage';
	'@id': string;
	mainEntity: SchemaQuestion[];
}

export interface SchemaOrganization {
	'@type': 'Organization';
	'@id': string;
	name: string;
	url: string;
	logo: string;
	description: string;
}

export interface SchemaWebSite {
	'@type': 'WebSite';
	'@id': string;
	url: string;
	name: string;
	description: string;
	publisher: {
		'@id': string;
	};
	inLanguage: string;
}

export interface LandingSchemaGraph {
	'@context': 'https://schema.org';
	'@graph': [SchemaOrganization, SchemaWebSite, SchemaFaqPage];
}

export function buildLandingSchemaJsonLd(siteOrigin = DEFAULT_SITE_ORIGIN): LandingSchemaGraph {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': `${siteOrigin}/#organization`,
				name: 'Celebra-me',
				url: siteOrigin,
				logo: `${siteOrigin}/favicon.svg`,
				description:
					'Invitaciones digitales interactivas de alta gama con confirmación de asistencia RSVP en tiempo real.',
			},
			{
				'@type': 'WebSite',
				'@id': `${siteOrigin}/#website`,
				url: siteOrigin,
				name: 'Celebra-me',
				description: landingData.seo.description,
				publisher: {
					'@id': `${siteOrigin}/#organization`,
				},
				inLanguage: 'es-MX',
			},
			{
				'@type': 'FAQPage',
				'@id': `${siteOrigin}/#faq`,
				mainEntity: landingData.faq.faqs.map((faq) => ({
					'@type': 'Question',
					name: faq.question,
					acceptedAnswer: {
						'@type': 'Answer',
						text: faq.answer,
					},
				})),
			},
		],
	};
}
