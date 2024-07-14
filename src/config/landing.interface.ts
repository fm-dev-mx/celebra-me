export interface LandingPageData {
	meta: Meta;
	headerData: HeaderData;
	heroData: HeroData;
	servicesData: ServicesData;
	aboutData: AboutData;
	pricingData: PricingData;
	testimonialsData: TestimonialsData;
	footerData: FooterData;
}

export interface HeaderData {
	logo: string;
	links: Link[];
}

export interface HeroData {
	title: string;
	subTitle: string;
	primaryCta: string;
	secondaryCta: string;
	highlightedTitle: string;
	backgroundImage?: string;
	backgroundImageMobile?: string;
}

export interface ServicesData {
	title: string;
	services: Service[];
}

export interface Service {
	title: string;
	description: string;
	icon: Icon;
}

export interface FooterData {
	logo: string;
	description: string;
	links: Link[];
	socials: Social[];
}

export interface Link {
	label: string;
	href: string;
}

export interface Social {
	icon: Icon;
	href: string;
}

export interface AboutData {
	title: string;
	description: string;
	values: Value[];
	cta: Cta;
}

export interface Value {
	icon: Icon;
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

export type Icon =
	| "CheckIcon"
	| "InstagramIcon"
	| "GithubIcon"
	| "LinkedInIcon"
	| "FacebookIcon"
	| "WeddingIcon"
	| "CrownIcon"
	| "CakeIcon"
	| "AnniversaryIcon"
	| "GraduationIcon"
	| "CelebrameIcon"
	| "ExclusiveIcon"
	| "EasyUseIcon"
	| "CommitmentIcon"
	| "ArrowDownIcon"
	| "FavIcon";
