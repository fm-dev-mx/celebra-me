// src/services/data.service.ts

import type { LandingPageData } from '@interfaces/data/landingPage.interface';
import { SiteInfo } from '@interfaces/data/siteInfo.interface';
import landingData from '@/core/data/landingPage.json';
import siteInfo from '@/core/data/siteInfo.json';

/**
 * Retrieves landing page data synchronously.
 * @returns LandingPageData object containing all landing page information.
 */
export const getLandingData = (): LandingPageData => {
	return landingData as LandingPageData;
};

/**
 * Retrieves site data synchronously.
 * @returns SiteInfo object containing site information.
 */
export const getSiteInfo = (): SiteInfo => {
	return siteInfo as SiteInfo;
};
