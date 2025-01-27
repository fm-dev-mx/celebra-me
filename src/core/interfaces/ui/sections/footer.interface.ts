// src/core/interfaces/ui/sections/footer.interface.ts

import { SiteInfo } from '@/core/interfaces/data/siteInfo.interface';
import { ContactData } from '@/core/interfaces/data/contactData.interface';
import { SocialLinkList } from '@/core/interfaces/ui/components/socialLink.interface';

/**
 * Interface for Footer component props.
 */
export interface FooterProps {
	siteInfo: SiteInfo; // Basic site information
	contactData?: ContactData; // Optional contact details
	linkGroups: FooterLinkGroup[]; // Grouped footer links
	socialLinks?: SocialLinkList; // Optional social media links
}

/**
 * Interface for a group of footer links.
 */
export interface FooterLinkGroup {
	title: string; // Title of the group (e.g., "Resources")
	links: FooterLinkProps[]; // Links within the group
}

/**
 * Interface for an individual footer link.
 */
export interface FooterLinkProps {
	label: string; // Link text
	href: string; // URL for the link
	isExternal?: boolean; // Indicates if the link is external
	target?: '_blank' | '_self'; // HTML target attribute
}
