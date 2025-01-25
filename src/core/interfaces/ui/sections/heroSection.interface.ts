// src/core/interfaces/ui/sections/heroSection.interface.ts

export interface HeroSection {
	title: string;
	subtitle: string;
	primaryCta: string;
	secondaryCta: string;
	backgroundImage: BackgroundImage;
}

export interface BackgroundImage {
	desktopUrl: string;
	desktipAlt: string;
	mobileUrl: string;
	mobileAlt: string;
}
