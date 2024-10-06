// src/services/data.service.ts

import type { LandingPageData } from "@/config/landing.interface";
import type { BasicDemoData } from "@/config/basic-demo.interface";
import type { SiteData } from "@/config/site-data.interface";
import landingData from "@/data/landing.json";
import basicDemoData from "@/data/basic-demo.json";
import siteData from "@/data/site-data.json";

/**
 * Retrieves landing page data synchronously.
 * @returns LandingPageData object containing all landing page information.
 */
export const getLandingData = (): LandingPageData => {
	return landingData as LandingPageData;
};

/**
 * Retrieves basic demo data synchronously.
 * @returns BasicDemoData object containing demo invitation details.
 */
export const getBasicDemoData = (): BasicDemoData => {
	return basicDemoData as BasicDemoData;
};

/**
 * Retrieves site metadata synchronously.
 * @returns SiteData object containing meta tags and SEO data.
 */
export const getSiteData = (): SiteData => {
	return siteData as SiteData;
};
