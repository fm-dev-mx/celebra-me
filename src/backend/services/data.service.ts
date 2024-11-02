// src/services/data.service.ts

import type { LandingPageData } from "@/core/interfaces/landingPage.interface";
import type { BasicDemoData } from "@/core/interfaces/basicDemo.interface";
import type { SiteData } from "@/core/interfaces/siteData.interface";
import landingData from "@/core/data/landingPage.json";
import basicDemoData from "@/core/data/basicDemo.json";
import siteData from "@/core/data/siteData.json";

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
