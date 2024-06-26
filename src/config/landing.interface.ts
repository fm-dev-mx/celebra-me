export interface LandingPageData {
	meta: Meta;
	headerData: HeaderData;
	heroData: HeroData;
	servicesData: ServicesData;
	advantagesData: advantagesData;
	aboutData: AboutData;
	pricingData: PricingData;
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
	icon: string;
	description: string;
}

export interface advantagesData {
	title: string;
	advantages: advantage[];
}

export interface advantage {
	title: string;
	description: string;
	img: string;
	imageAlt: string;
	checks: string[];
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
	icon: string;
	href: string;
}

export interface AboutData {
	values: Value[];
	testimonials: Testimonial[];
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	cta: Cta;
}

export interface Value {
	icon: Icon;
	name: string;
	description: string;
}

export interface Testimonial {
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
	| "BriefcaseIcon"
	| "CelebrameIcon"
	| "ExclusiveIcon"
	| "EasyUseIcon"
	| "CommitmentIcon"
	| "ArrowDownIcon";
