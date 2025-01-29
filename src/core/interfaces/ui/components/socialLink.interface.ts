// src/core/interfaces/ui/socialLink.interface.ts
import { SocialLinkVariants } from '@customTypes/ui/socialLinkVariants.type';
import { LinkProps } from './link.interface';

export type SocialPlatform =
	| 'Facebook'
	| 'Twitter'
	| 'Instagram'
	| 'WhatsApp'
	| 'LinkedIn'
	| 'TikTok'
	| 'YouTube';

export interface SocialLinkProps extends LinkProps {
	platform: SocialPlatform; // Made mandatory for consistency
	variant?: SocialLinkVariants; // Optional: style variant
}

export interface SocialLinkList {
	links: SocialLinkProps[]; // List of social links
	variant?: SocialLinkVariants; // Optional: default variant for all links
}
