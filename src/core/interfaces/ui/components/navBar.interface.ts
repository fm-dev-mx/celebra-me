// src/core/interfaces/ui/components/navBar.interface.ts

import { SocialLinkList } from '@/core/interfaces/ui/components/socialLink.interface';
import { BaseLink } from './link.interface';

export interface NavBarProps {
	links?: BaseLink[];
	socialLinkList?: SocialLinkList;
	ctaLabel?: string;
	headerId?: string;
}
