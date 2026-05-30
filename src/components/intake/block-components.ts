import type { FC } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';
import EventDetailsBlock from '@/components/intake/blocks/EventDetailsBlock';
import MainPeopleBlock from '@/components/intake/blocks/MainPeopleBlock';
import DateLocationsBlock from '@/components/intake/blocks/DateLocationsBlock';
import PhotosBlock from '@/components/intake/blocks/PhotosBlock';
import RsvpConfigBlock from '@/components/intake/blocks/RsvpConfigBlock';
import MusicBlock from '@/components/intake/blocks/MusicBlock';
import GiftsBlock from '@/components/intake/blocks/GiftsBlock';
import SpecialMessagesBlock from '@/components/intake/blocks/SpecialMessagesBlock';

export interface IntakeBlockComponentProps {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

export const INTAKE_BLOCK_COMPONENTS: Record<IntakeBlockType, FC<IntakeBlockComponentProps>> = {
	'event-details': EventDetailsBlock,
	'main-people': MainPeopleBlock,
	'date-locations': DateLocationsBlock,
	photos: PhotosBlock,
	'rsvp-config': RsvpConfigBlock,
	music: MusicBlock,
	gifts: GiftsBlock,
	'special-messages': SpecialMessagesBlock,
};
