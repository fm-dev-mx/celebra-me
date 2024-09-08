export interface LandingPageData {
	meta: Meta;
	headerData: HeaderData;
	heroData: HeroData;
	servicesData: ServicesData;
	aboutData: AboutData;
	pricingData: PricingData;
	testimonialsData: TestimonialsData;
	faqData: FAQData;
	contactData: ContactData;
	footerData: FooterData;
}

export interface HeaderData {
	links: Link[];
	cta: Cta;
}

export interface HeroData {
	title: string;
	subTitle: string;
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

export interface FooterData {
	logo: string;
	icon: IconNames;
	description: string;
	links: Link[];
	socials: Social[];
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
	ldJson: LdJson;
}

export interface LdJson {
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
	| "FavIcon"
	| "InstagramIcon"
	| "MenuIcon"
	| "TikTokIcon"
	| "WeddingIcon"
	| "WhatsAppIcon";


