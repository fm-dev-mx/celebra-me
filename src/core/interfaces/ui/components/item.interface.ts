// src/core/interfaces/ui/components/item.interface.ts
import { IconNames } from '@/core/types/ui/iconNames.type';

/*
 * Represents a generic item within a section.
 * In more specific sections (e.g., Services), you might create a specialized interface (e.g., ServiceItem).
 */
export interface BaseItem {
	/** Could be an icon name from your icon set or a URL to an icon image */
	icon?: IconNames; // or string, if you prefer a more flexible type
	/** Main label for this item */
	label?: string;
	/** Description for this item */
	description?: string;
}
