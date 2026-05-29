import type { IntakeBlockDefinition, IntakeBlockType } from '@/lib/intake/types';
import type { EventType } from '@/lib/theme/theme-contract';
import { eventDetailsBlock } from '@/lib/intake/blocks/event-details.block';
import { mainPeopleBlock } from '@/lib/intake/blocks/main-people.block';
import { dateLocationsBlock } from '@/lib/intake/blocks/date-locations.block';
import { photosBlock } from '@/lib/intake/blocks/photos.block';
import { rsvpConfigBlock } from '@/lib/intake/blocks/rsvp-config.block';
import { musicBlock } from '@/lib/intake/blocks/music.block';
import { giftsBlock } from '@/lib/intake/blocks/gifts.block';
import { specialMessagesBlock } from '@/lib/intake/blocks/special-messages.block';

const BLOCK_REGISTRY: Record<IntakeBlockType, IntakeBlockDefinition> = {
	'event-details': eventDetailsBlock,
	'main-people': mainPeopleBlock,
	'date-locations': dateLocationsBlock,
	photos: photosBlock,
	'rsvp-config': rsvpConfigBlock,
	music: musicBlock,
	gifts: giftsBlock,
	'special-messages': specialMessagesBlock,
};

export function getBlockDefinition(type: IntakeBlockType): IntakeBlockDefinition {
	return BLOCK_REGISTRY[type];
}

export function getAllBlockDefinitions(): IntakeBlockDefinition[] {
	return Object.values(BLOCK_REGISTRY);
}

export function getBlocksForEventType(eventType: EventType): IntakeBlockDefinition[] {
	return Object.values(BLOCK_REGISTRY).filter((block) =>
		block.supportedEventTypes.includes(eventType),
	);
}

export function getBlockTypesForEventType(eventType: EventType): IntakeBlockType[] {
	return getBlocksForEventType(eventType).map((block) => block.type);
}
