export interface LegacyAboutData {
	title: string;
	description: string;
	values: Array<{
		name: string;
		description: string;
		icon: string;
	}>;
	cta: {
		label: string;
		href: string;
	};
}

export interface LegacyPricingData {
	title: string;
	tiers: Array<{
		title: string;
		description: string;
		price: {
			amount: string;
			currency: string;
			period: string;
		};
		features: string[];
		cta: string;
		href: string;
	}>;
}

export interface LegacyServicesData {
	title: string;
	services: Array<{
		title: string;
		description: string;
		icon?: string;
	}>;
}

export interface LegacyTestimonialsData {
	title: string;
	testimonials: Array<{
		name: string;
		text: string;
		role?: string;
	}>;
}

export interface LegacyContactData {
	title: string;
	subtitle: string;
}

export interface LegacyFAQData {
	title: string;
	faqs: Array<{
		question: string;
		answer: string;
	}>;
}

export interface LegacyHeroProps {
	title: string;
	subtitle: string;
	backgroundImage: {
		desktopUrl: string;
		mobileUrl: string;
	};
	primaryCta: string;
	secondaryCta: string;
}
