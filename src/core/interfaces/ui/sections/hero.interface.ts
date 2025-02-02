// src/core/interfaces/ui/sections/hero.interface.ts

import { BaseButton } from '../components/button.interface';
import { BaseLink } from '../components/link.interface';
import { BaseSection } from './section.interface';

/**
 * HeroSection extends BaseSection to include specific properties for Hero sections.
 */
export interface HeroProps extends BaseSection {
	/** Primary CTA that triggers an action (e.g., opens a modal) */
	primaryCta: BaseButton;

	/** Secondary CTA that redirects the user (e.g., internal navigation) */
	secondaryCta?: BaseLink;
}
