export interface HeroData {
	title: string;
	subtitle: string;
	backgroundImage: {
		desktopUrl: string;
		mobileUrl: string;
		videoUrl?: string;
	};
	primaryCtaLabel: string;
	primaryCtaUrl: string;
	secondaryCtaLabel: string;
	secondaryCtaUrl: string;
	whatsappPhone?: string;
	whatsappMessage?: string;
	socialProofText?: string;
}

export interface AboutData {
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

export interface ServicesData {
	title: string;
	services: Array<{
		href: string;
		title: string;
		description: string;
		icon?: string;
	}>;
}

export interface PricingData {
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
		isElite?: boolean;
	}>;
}

export interface TestimonialsData {
	title: string;
	testimonials: Array<{
		name: string;
		text: string;
		role?: string;
	}>;
}

export interface FAQData {
	title: string;
	faqs: Array<{
		question: string;
		answer: string;
	}>;
}

export interface ContactData {
	title: string;
	subtitle: string;
}

export interface LandingPageData {
	hero: HeroData;
	about: AboutData;
	services: ServicesData;
	pricing: PricingData;
	testimonials: TestimonialsData;
	faq: FAQData;
	contact: ContactData;
}
