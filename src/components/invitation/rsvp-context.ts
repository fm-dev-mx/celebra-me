import { createContext, useContext } from 'react';
import type { RsvpDefaultCopy } from '@/components/invitation/rsvp-logic';

export interface RsvpContextValue {
	eventType?: string;
	defaultCopy?: RsvpDefaultCopy;
	/** Passes reserved for children; the children field shows only when > 0. */
	maxChildren?: number;
	childrenCount?: number | string;
	onChildrenCountChange?: (value: string) => void;
	/** Host-set RSVP deadline, already formatted ("20 de noviembre de 2026"). */
	deadlineLabel?: string;
}

const RsvpContext = createContext<RsvpContextValue>({});

export function useRsvpContext(): RsvpContextValue {
	return useContext(RsvpContext);
}

export default RsvpContext;
