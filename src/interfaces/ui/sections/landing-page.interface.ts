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
	secondaryCtaLabel: string;
	secondaryCtaUrl: string;
	secondaryCtaDemoSlug?: string;
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
	cta: {
		label: string;
		message?: string;
	};
}

export interface GuestExperienceData {
	eyebrow?: string;
	title: string;
	description: string;
	values: Array<{
		name: string;
		description: string;
	}>;
	closingLine?: string;
	cta: {
		label: string;
		message?: string;
	};
}

export interface PricingTierDetail {
	label: string;
	value: string;
}

/**
 * Package card copy. Names, prices, promo codes and WhatsApp messages are resolved from
 * `src/data/promo-campaign.data.ts` through `packageId`.
 */
export interface PricingTier {
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
	formIntro?: string;
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
	};
	hero: HeroData;
	eventSelector?: {
		eyebrow: string;
		title: string;
		description: string;
		cta?: string;
	};
	productProof: ProductProofData;
	guestExperience: GuestExperienceData;
	pricing: PricingData;
	testimonials: TestimonialsData;
	faq: FAQData;
	contact: ContactData;
	howItWorks: HowItWorksData;
}
