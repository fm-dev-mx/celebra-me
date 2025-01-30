// src/core/interfaces/ui/sections/heroSection.interface.ts

import { BgImageSection } from '../assets/bgImageSection.interface';

export interface LegacyHeroProps {
	title: string;
	subtitle: string;
	primaryCta: string;
	secondaryCta: string;
	backgroundImage: BgImageSection;
}
