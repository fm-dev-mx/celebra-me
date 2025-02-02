// src/core/interfaces/ui/components/link.interface.ts

import { IconNames } from '@customTypes/ui/iconNames.type';

/**
 * BaseLink: defines the structure for hyperlinks in the application.
 */
export interface BaseLink {
	/** Text displayed in the link */
	label?: string;

	/** URL the link points to */
	href: string;

	/** Indicates if the link is external */
	isExternal?: boolean;

	/** Specifies the link's target */
	target?: '_blank' | '_self' | '_parent' | '_top';

	/** Relationship (SEO, security) for the link */
	rel?: 'noopener noreferrer' | 'noopener' | 'noreferrer' | 'nofollow' | 'sponsored';

	/** Optional icon for the link */
	icon?: IconNames;

	/** Optional flag for rendering the link as a button */
	isButton?: boolean;
}

/**
 * LinkGroup: a collection of related links under a common title.
 */
export interface LinkGroup {
	title: string;
	links: BaseLink[];
}
