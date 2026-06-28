import type { ImageMetadata } from 'astro';
import type { ImageAsset } from '@/lib/assets/asset-registry';

export interface VenueEventItem {
	name: string;
	time: string;
}

export interface VenueData {
	venueEvent: string;
	venueName: string;
	address: string;
	city?: string;
	date: string;
	time: string;
	mapUrl?: string;
	appleMapsUrl?: string;
	googleMapsUrl?: string;
	wazeUrl?: string;
	image?: string | ImageMetadata | ImageAsset;
	focalPoint?: string;
	coordinates?: {
		lat: number;
		lng: number;
	};
}

export interface VenueEntry extends VenueData {
	id?: string;
	type?: string;
	label?: string;
	isVisible?: boolean;
	sortOrder?: number;
}

export interface GroupedVenue extends VenueEntry {
	events?: VenueEventItem[];
}

/**
 * Normalizes a string for comparison by removing leading/trailing spaces and lowering case.
 */
function normalize(str?: string): string {
	return (str || '').trim().toLowerCase();
}

/**
 * Groups location cards that share the same venue based on Google Maps URL or fallback details.
 * If multiple locations share the same googleMapsUrl, they are grouped.
 * If googleMapsUrl is missing, it falls back to matching normalized venueName + address.
 */
export function groupVenues(venues: VenueEntry[]): GroupedVenue[] {
	if (!venues || venues.length <= 1) {
		return venues;
	}

	const grouped: GroupedVenue[] = [];
	const visited = new Set<number>();

	for (let i = 0; i < venues.length; i++) {
		if (visited.has(i)) continue;

		const current = venues[i];
		const groupIndices = [i];

		for (let j = i + 1; j < venues.length; j++) {
			if (visited.has(j)) continue;

			const other = venues[j];

			let shouldGroup = false;

			const currentGMap = normalize(current.googleMapsUrl);
			const otherGMap = normalize(other.googleMapsUrl);

			if (currentGMap && otherGMap) {
				shouldGroup = currentGMap === otherGMap;
			} else if (!currentGMap && !otherGMap) {
				const currentVenueName = normalize(current.venueName);
				const otherVenueName = normalize(other.venueName);
				const currentAddress = normalize(current.address);
				const otherAddress = normalize(other.address);

				shouldGroup =
					currentVenueName === otherVenueName && currentAddress === otherAddress;
			}

			if (shouldGroup) {
				groupIndices.push(j);
				visited.add(j);
			}
		}

		visited.add(i);

		if (groupIndices.length > 1) {
			const itemsToGroup = groupIndices.map((idx) => venues[idx]);

			// Create a consolidated list of events/times
			const events: VenueEventItem[] = itemsToGroup.map((item) => ({
				name: item.venueEvent,
				time: item.time,
			}));

			// Consolidate into one card
			const groupedVenue: GroupedVenue = {
				...current,
				venueEvent: 'ITINERARIO EN SEDE', // Editorial label for the grouped card title
				type: 'grouped',
				events,
			};

			grouped.push(groupedVenue);
		} else {
			grouped.push(current);
		}
	}

	return grouped;
}
