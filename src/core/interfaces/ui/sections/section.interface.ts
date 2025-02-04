/*
 * src/core/interfaces/ui/sections/section.interface.ts
 * -------------------------------------------------
 * Section Component Interface.
 * -------------------------------------------------
 */
import { BaseImage } from '../components/image.interface';

export interface BaseSection {
	/** Unique section identifier */
	id: string;
	/** Main title */
	title: string;
	/** Optional subtitle */
	subtitle?: string;
	/** Optional description */
	description?: string;
	/** Optional background color */
	backgroundColor?: string;
	/** Optional desktop background image */
	backgroundDesktop?: BaseImage;
	/** Optional mobile background image */
	backgroundMobile?: BaseImage;
	/** Additional CSS class(es) */
	className?: string;
}
