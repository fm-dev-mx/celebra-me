import type { PromoPackageId } from '@/data/promo-campaign.data';

export interface HeroData {
	eyebrow?: string;
	title: string;
	subtitle: string;
	mobileTitle?: string;
	mobileSubtitle?: string;
	/** "Desde <starting price> <suffix>"; the price comes from the promo module. */
	priceLine: {
		prefix: string;
		suffix: string;
	};
	paymentNote: string;
	primaryCtaLabel: string;
	/** Reassurance line rendered right under the primary CTA. */
	primaryCtaTrustLine: string;
	/** Words of the title set in italics, e.g. "confirmación". */
	titleEmphasis?: string;
	/** Hint under the three phones; each phone opens its demo in the showroom. */
	fanLabel: string;
	proofLine?: string;
}

export interface ProductProofData {
	eyebrow?: string;
	title: string;
	description: string;
	/** What the host sees and does in the guest panel. */
	features: Array<{
		title: string;
		text: string;
	}>;
}

interface PricingTierDetail {
	label: string;
	value: string;
}

/**
 * Package card copy. Names, prices, promo codes and WhatsApp messages are resolved from
 * `src/data/promo-campaign.data.ts` through `packageId`.
 */
interface PricingTier {
	packageId: PromoPackageId;
	badge?: string;
	isPrimary?: boolean;
	isExclusive?: boolean;
	/** Lead-in for incremental tiers, e.g. "Todo lo de Esencial, más:". */
	includesFrom?: string;
	includes: string[];
	details: PricingTierDetail[];
}

export interface PricingData {
	eyebrow?: string;
	title: string;
	intro?: string;
	extras?: {
		title: string;
		items: string[];
	};
	tiers: PricingTier[];
}

/** Anonymous client quote: role and event type only, never the client name. */
export interface TestimonialItem {
	text: string;
	role: string;
	eventLabel?: string;
}

export interface TestimonialsData {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	testimonials: TestimonialItem[];
	notice?: string;
	proofLine?: string;
}

export interface FAQData {
	pretitle?: string;
	title: string;
	subtitle?: string;
	faqs: Array<{
		question: string;
		answer: string;
	}>;
	helpSection?: {
		title: string;
		description: string;
		cta: string;
	};
}

export interface ContactData {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	cta?: {
		label: string;
		message?: string;
	};
	microcopy?: string;
	/** Heading of the WhatsApp card. */
	cardIntro?: string;
	/** Details the visitor can include in the WhatsApp message. */
	checklist?: string[];
	about?: {
		title: string;
		text: string;
		email: string;
	};
}

export interface HowItWorksData {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	deliveryDossier?: {
		title: string;
		subtitle?: string;
		rows: Array<{ label: string; status: string }>;
		footnote?: string;
	};
	steps: Array<{
		title: string;
		description?: string;
	}>;
	cta?: {
		label: string;
		message?: string;
	};
}

export interface LandingPageData {
	seo: {
		title: string;
		description: string;
		ogTitle?: string;
		ogDescription?: string;
		ogImage?: string;
	};
	hero: HeroData;
	vitrina: {
		title: string;
		description: string;
	};
	productProof: ProductProofData;
	pricing: PricingData;
	testimonials: TestimonialsData;
	faq: FAQData;
	contact: ContactData;
	howItWorks: HowItWorksData;
}
