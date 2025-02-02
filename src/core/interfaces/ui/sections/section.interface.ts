// src/core/interfaces/ui/sections/section.interface.ts

import { BaseImage } from '../components/image.interface';

/**
 * BaseSection: Generic interface for any section of the page.
 */
export interface BaseSection {
	/** Unique identifier for the section */
	id: string;

	/** Main title of the section */
	title: string;

	/** Optional subtitle */
	subtitle?: string;

	/** Optional description */
	description?: string;

	/** Optional background color (CSS-compatible values) */
	backgroundColor?: string;

	/** Optional background image URL */
	backgroundDesktop?: BaseImage;

	/** Optional background image URL for mobile */
	backgroundMobile?: BaseImage;

	/**
	 * Optional CSS class(es) for custom styles or Tailwind utilities.
	 */
	className?: string;
}
