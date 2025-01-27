// src/core/interfaces/data/landingPage.interface.ts

import { HeroProps } from '../ui/sections/hero.interface';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { NavBarProps } from '../ui/components/navBar.interface';

/**
 * Interface representing the data structure for the landing page.
 */
export interface LandingPageData {
	navBarData: NavBarProps;
	heroData: HeroProps;
	servicesData: ServicesData;
	aboutData: AboutData;
	pricingData: PricingData;
	testimonialsData: TestimonialsData;
	faqData: FAQData;
	contactData: ContactData;
}

/**
 * Interface for services section data.
 */
export interface ServicesData {
	title: string;
	services: Service[];
}

/**
 * Interface for individual service.
 */
export interface Service {
	title: string;
	description: string;
	icon: IconNames;
}

/**
 * Interface for about us section data.
 */
export interface AboutData {
	title: string;
	description: string;
	values: Value[];
	cta: Cta;
}

/**
 * Interface for individual value in about us section.
 */
export interface Value {
	icon: IconNames;
	name: string;
	description: string;
}

/**
 * Interface for call-to-action link.
 */
export interface Cta {
	label: string;
	href: string;
}

/**
 * Interface for pricing section data.
 */
export interface PricingData {
	title: string;
	tiers: Tier[];
}

/**
 * Interface for individual pricing tier.
 */
export interface Tier {
	title: string;
	description: string;
	price: Price;
	features: string[];
	href: string;
	cta: string;
}

/**
 * Interface for price information.
 */
export interface Price {
	amount: number;
	currency?: string;
	period?: string;
}

/**
 * Interface for testimonials section data.
 */
export interface TestimonialsData {
	title: string;
	testimonials: Testimonial[];
}

/**
 * Interface for individual testimonial.
 */
export interface Testimonial {
	id: number;
	image: string;
	content: string;
	author: string;
}

/**
 * Interface for FAQ section data.
 */
export interface FAQData {
	title: string;
	questions: Question[];
}

/**
 * Interface for individual question in FAQ.
 */
export interface Question {
	question: string;
	answer: string;
}

/**
 * Interface for contact section data.
 */
export interface ContactData {
	title: string;
	subtitle: string;
	cta: string;
	emailTo: string;
}
