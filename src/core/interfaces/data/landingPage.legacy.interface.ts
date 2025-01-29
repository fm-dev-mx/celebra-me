// src/core/interfaces/data/landingPage.interface.ts

import { LegacyHeroProps } from '../ui/sections/hero.interface';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { NavBarProps } from '../ui/components/navBar.interface';
import { LinkProps } from '../ui/components/link.interface';

/**
 * Interface representing the data structure for the landing page.
 */
export interface LegacyLandingPageData {
	navBarData: NavBarProps;
	heroData: LegacyHeroProps;
	servicesData: LegacyServicesData;
	aboutData: LegacyAboutData;
	pricingData: LegacyPricingData;
	testimonialsData: LegacyTestimonialsData;
	faqData: LegacyFAQData;
	contactData: LegacyContactData;
}

/**
 * Interface for services section data.
 */
export interface LegacyServicesData {
	title: string;
	services: LegacyService[];
}

/**
 * Interface for individual service.
 */
export interface LegacyService {
	title: string;
	description: string;
	icon: IconNames;
}

/**
 * Interface for about us section data.
 */
export interface LegacyAboutData {
	title: string;
	description: string;
	values: LegacyValue[];
	cta: LinkProps;
}

/**
 * Interface for individual value in about us section.
 */
export interface LegacyValue {
	icon: IconNames;
	name: string;
	description: string;
}

/**
 * Interface for pricing section data.
 */
export interface LegacyPricingData {
	title: string;
	tiers: LegacyTier[];
}

/**
 * Interface for individual pricing tier.
 */
export interface LegacyTier {
	title: string;
	description: string;
	price: LegacyPrice;
	features: string[];
	href: string;
	cta: string;
}

/**
 * Interface for price information.
 */
export interface LegacyPrice {
	amount: number;
	currency?: string;
	period?: string;
}

/**
 * Interface for testimonials section data.
 */
export interface LegacyTestimonialsData {
	title: string;
	testimonials: LegacyTestimonial[];
}

/**
 * Interface for individual testimonial.
 */
export interface LegacyTestimonial {
	id: number;
	image: string;
	content: string;
	author: string;
}

/**
 * Interface for FAQ section data.
 */
export interface LegacyFAQData {
	title: string;
	questions: LegacyQuestion[];
}

/**
 * Interface for individual question in FAQ.
 */
export interface LegacyQuestion {
	question: string;
	answer: string;
}

/**
 * Interface for contact section data.
 */
export interface LegacyContactData {
	title: string;
	subtitle: string;
	cta: string;
	emailTo: string;
}
