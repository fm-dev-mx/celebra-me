export interface LandingPageData {
	meta: Meta;
	menuData: MenuData;
	siteData: SiteData;
	heroData: HeroData;
	socialData: SocialData;
	servicesData: ServicesData;
	aboutData: AboutData;
	pricingData: PricingData;
	testimonialsData: TestimonialsData;
	faqData: FAQData;
	contactData: ContactData;
}

export interface SiteData {
	title: string;
	slogan: string;
	description: string;
	lang: string;
	charset: string;
}

export interface MenuData {
	links: Link[];
}

export interface SocialData {
	socialLinks: SocialLink[];
}
export interface SocialLink {
	icon: IconNames;
	href: string;
	title?: string;
}

export interface HeroData {
	title: string;
	slogan: string;
	primaryCta: string;
	secondaryCta: string;
}

export interface ServicesData {
	title: string;
	services: Service[];
}

export interface Service {
	title: string;
	description: string;
	icon: IconNames;
}

export interface Link {
	label: string;
	href: string;
}

export interface Social {
	icon: IconNames;
	href: string;
	title?: string;
}

export interface AboutData {
	title: string;
	description: string;
	values: Value[];
	cta: Cta;
}

export interface Value {
	icon: IconNames;
	name: string;
	description: string;
}

export interface TestimonialsData {
	title: string;
	testimonials: Testimonial[];
}

export interface Testimonial {
	id: number;
	image: string;
	content: string;
	author: string;
}

export interface Cta {
	label: string;
	href: string;
}

export interface PricingData {
	title: string;
	tiers: Tier[];
}

export interface Tier {
	title: string;
	description: string;
	price: Price;
	features: string[];
	href: string;
	cta: string;
}

export interface Price {
	amount: string;
	period?: string;
}

export interface Meta {
	title: string;
	description: string;
	lang: string;
	charset: string;
	seoData: SeoData;
}

export interface SeoData {
	"@context": string;
	"@type": string;
	name: string;
	description: string;
	url: string;
	logo: string;
	contactPoint: {
		"@type": string;
		email: string;
		contactType: string;
	};
	sameAs: string[];
}

export interface FAQData {
	title: string;
	questions: Question[];
}

export interface Question {
	question: string;
	answer: string;
}

export interface ContactData { // Added ContactData interface
	title: string;
	subtitle: string;
	cta: string;
	emailTo: string; // Email to which the form will be submitted
}

// Added Icon interface to support custom icons
export type IconNames =
	| "AnniversaryIcon"
	| "ArrowDownIcon"
	| "ArrowUpIcon"
	| "CakeIcon"
	| "CelebrameIcon"
	| "CheckIcon"
	| "CommitmentIcon"
	| "CrownIcon"
	| "EasyUseIcon"
	| "ExclusiveIcon"
	| "FacebookIcon"
	| "InstagramIcon"
	| "MenuIcon"
	| "CloseIcon"
	| "TikTokIcon"
	| "WeddingIcon"
	| "WhatsAppIcon";


