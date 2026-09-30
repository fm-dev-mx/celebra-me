import type { PromoPackageId } from '@/data/promo-campaign.data';

export interface HeroData {
	eyebrow?: string;
	title: string;
	subtitle: string;
	mobileTitle?: string;
	mobileSubtitle?: string;
	primaryCtaLabel: string;
	secondaryCtaLabel: string;
	secondaryCtaUrl: string;
	proofLine?: string;
}

export interface ProductProofData {
	eyebrow?: string;
	title: string;
	description: string;
	items?: Array<{
		title: string;
		description: string;
	}>;
	railTitle?: string;
	railItems?: Array<{
		title: string;
		text: string;
	}>;
	proofLine?: string;
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

export interface ServicesData {
	title: string;
	subtitle: string;
	eyebrow?: string;
	dossierSubtext?: string;
	dossierTag?: string;
	closingStatement?: string;
	items: Array<{
		title: string;
		description: string;
	}>;
	cta: {
		label: string;
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
	eyebrow: string;
	title: string;
	intro: string;
	extras: {
		title: string;
		items: string[];
	};
	tiers: PricingTier[];
}

export interface TestimonialItem {
	name: string;
	text: string;
	role?: string;
	guests?: string;
}

export interface TestimonialsData {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	testimonials: TestimonialItem[];
	proofLine?: string;
}

export interface FAQData {
	pretitle?: string;
	title: string;
	subtitle?: string;
	divider?: string;
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
	subtitle: string;
	cta?: {
		label: string;
		message?: string;
	};
	microcopy?: string;
	formIntro?: string;
	channelPrimary?: {
		label: string;
		value: string;
	};
	channelSecondary?: {
		label: string;
		value: string;
	};
}

export interface HowItWorksData {
	eyebrow?: string;
	title: string;
	subtitle: string;
	deliveryDossier?: {
		title: string;
		subtitle?: string;
		rows: Array<{ label: string; status: string }>;
		footnote?: string;
	};
	steps: Array<{
		title: string;
		description: string;
	}>;
	cta?: {
		label: string;
		message?: string;
	};
}

export interface LandingPageData {
	hero: HeroData;
	eventSelector?: {
		eyebrow: string;
		title: string;
		description: string;
		cta?: string;
	};
	productProof: ProductProofData;
	guestExperience: GuestExperienceData;
	services: ServicesData;
	pricing: PricingData;
	testimonials: TestimonialsData;
	faq: FAQData;
	contact: ContactData;
	howItWorks: HowItWorksData;
}
