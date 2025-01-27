// src/core/interfaces/ui/socialLink.interface.ts
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { SocialLinkVariants } from '@customTypes/ui/socialLinkVariants.type';

export type SocialPlatform =
	| 'Facebook'
	| 'Twitter'
	| 'Instagram'
	| 'WhatsApp'
	| 'LinkedIn'
	| 'TikTok'
	| 'YouTube';

export interface SocialLinkProps {
	platform: SocialPlatform; // Made mandatory for consistency
	icon: IconNames; // Icon name, required for display
	url: string; // Social media link, must be valid
	title: string; // Tooltip or accessible label
	variant?: SocialLinkVariants; // Optional: style variant
}

export interface SocialLinkList {
	links: SocialLinkProps[]; // List of social links
	variant?: SocialLinkVariants; // Optional: default variant for all links
}
