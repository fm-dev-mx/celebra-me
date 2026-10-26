import { createContext, useContext } from 'react';
import type { RsvpDefaultCopy } from '@/components/invitation/rsvp-logic';

export interface RsvpContextValue {
	eventType?: string;
	defaultCopy?: RsvpDefaultCopy;
}

const RsvpContext = createContext<RsvpContextValue>({});

export function useRsvpContext(): RsvpContextValue {
	return useContext(RsvpContext);
}

export default RsvpContext;
