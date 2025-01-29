// src/core/interfaces/ui/sections/footer.interface.ts

import { SiteInfo } from '@/core/interfaces/data/siteInfo.interface';
import { ContactData } from '@/core/interfaces/data/contactData.interface';
import { SocialLinkList } from '@/core/interfaces/ui/components/socialLink.interface';
import { LinkGroup } from '../components/link.interface';

/**
 * Interface for Footer component props.
 */
export interface FooterProps {
	siteInfo: SiteInfo; // Basic site information
	contactData?: ContactData; // Optional contact details
	linkGroups: LinkGroup[]; // Grouped footer links
	socialLinks?: SocialLinkList; // Optional social media links
}
