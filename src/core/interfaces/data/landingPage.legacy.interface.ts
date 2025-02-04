/*
 * src/core/interfaces/data/landingPage.interface.ts
 * -------------------------------------------------
 * Landing page data interfaces.
 * -------------------------------------------------
 */

import { LegacyHeroProps } from '../ui/sections/hero.legacy.interface';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { NavBarProps } from '../ui/components/navBar.interface';
import { BaseLink } from '../ui/components/link.interface';
import { PricingProps } from '../ui/sections/pricing.interface';

export interface LegacyLandingPageData {
	navBarData: NavBarProps;
	heroData: LegacyHeroProps;
	servicesData: LegacyServicesData;
	aboutData: LegacyAboutData;
	pricingData: PricingProps;
	testimonialsData: LegacyTestimonialsData;
	faqData: LegacyFAQData;
	contactData: LegacyContactData;
}

export interface LegacyServicesData {
	title: string;
	services: LegacyService[];
}

export interface LegacyService {
	title: string;
	description: string;
	icon: IconNames;
}

export interface LegacyAboutData {
	title: string;
	description: string;
	values: LegacyValue[];
	cta: BaseLink;
}

export interface LegacyValue {
	icon: IconNames;
	name: string;
	description: string;
}

export interface LegacyTestimonialsData {
	title: string;
	testimonials: LegacyTestimonial[];
}

export interface LegacyTestimonial {
	id: number;
	image: string;
	content: string;
	author: string;
}

export interface LegacyFAQData {
	title: string;
	questions: LegacyQuestion[];
}

export interface LegacyQuestion {
	question: string;
	answer: string;
}

export interface LegacyContactData {
	title: string;
	subtitle: string;
	cta: string;
	emailTo: string;
}
