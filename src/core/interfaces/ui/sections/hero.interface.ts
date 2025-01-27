// src/core/interfaces/ui/sections/heroSection.interface.ts

import { BgImageSection } from '../assets/bgImageSection.interface';

export interface HeroProps {
	title: string;
	subtitle: string;
	primaryCta: string;
	secondaryCta: string;
	backgroundImage: BgImageSection;
}
