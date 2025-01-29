// src/core/interfaces/ui/components/navBar.interface.ts

import { SocialLinkList } from '@/core/interfaces/ui/components/socialLink.interface';
import { LinkProps } from './link.interface';

export interface NavBarProps {
	links?: LinkProps[];
	socialLinkList?: SocialLinkList;
	ctaLabel?: string;
	headerId?: string;
}
