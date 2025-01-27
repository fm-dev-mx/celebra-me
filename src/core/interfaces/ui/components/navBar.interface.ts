// src/core/interfaces/ui/components/navBar.interface.ts

import { SocialLinkList } from '@/core/interfaces/ui/components/socialLink.interface';

export interface NavBarProps {
	links?: NavigationLink[];
	socialLinkList?: SocialLinkList;
	ctaLabel?: string;
	headerId?: string;
}
export interface NavigationLink {
	label: string;
	href: string;
	isExternal?: boolean;
	target?: '_blank' | '_self';
}
