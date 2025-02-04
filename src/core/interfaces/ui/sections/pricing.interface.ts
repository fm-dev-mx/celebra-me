/*
 * src/core/interfaces/ui/sections/hero.interface.ts
 * -------------------------------------------------
 * Hero section interface.
 * -------------------------------------------------
 */
import { BaseSection } from './section.interface';

export interface PricingProps extends BaseSection {
	pricingTiers: PricingTier[];
}

export interface PricingTier {
	title: string;
	subtitle: string;
	price: Price;
	description: string;
	features: string[];
	href: string;
	cta: string;
}

export interface Price {
	amount: number;
	currency: 'MXN' | 'USD';
	period: 'x evento';
}
