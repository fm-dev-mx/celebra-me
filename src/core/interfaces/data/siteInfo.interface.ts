// src/core/interfaces/data/siteInfo.interface.ts

import { SeoData } from './seoData.interface';

/**
 * Interface for general site information.
 */
export interface SiteInfo {
	title: string; // Site title
	slogan: string;
	description: string; // Site description
	lang: string; // Language (e.g., 'en', 'es')
	charset: string; // Character encoding (e.g., 'UTF-8')
}
