import { createContext, useContext } from 'react';

export interface RsvpContextValue {
	eventType?: string;
}

const RsvpContext = createContext<RsvpContextValue>({});

export function useRsvpContext(): RsvpContextValue {
	return useContext(RsvpContext);
}

export default RsvpContext;
