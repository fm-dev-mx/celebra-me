/*
 * src/core/interfaces/ui/sections/hero.interface.ts
 * -------------------------------------------------
 * Hero section interface.
 * -------------------------------------------------
 */
import { BaseButton } from '../components/button.interface';
import { BaseLink } from '../components/link.interface';
import { BaseSection } from './section.interface';

export interface HeroProps extends BaseSection {
	/** Primary CTA (e.g., opens a modal) */
	primaryCta: BaseButton;

	/** Secondary CTA (e.g., navigates internally) */
	secondaryCta?: BaseLink;
}
