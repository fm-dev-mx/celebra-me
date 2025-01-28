// src/frontend/components/ui/header/HeaderBehavior.ts

import React, { useRef, useEffect } from 'react';
import { useHeaderBehavior } from '@hooks/header/useHeaderBehavior';

interface HeaderBehaviorProps {
	/** A CSS selector (e.g., "#main-header") pointing to the header element */
	selector: string;
}

/**
 * HeaderBehavior Component
 *
 * Applies header logic (scroll, hover, intersection) without rendering UI.
 * Receives a CSS selector from the .astro file instead of a direct React ref.
 */
const HeaderBehavior: React.FC<HeaderBehaviorProps> = ({ selector }) => {
	// A React ref to store the actual header DOM element
	const headerRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const elem = document.querySelector(selector);
		if (elem && elem instanceof HTMLElement) {
			headerRef.current = elem;
		}
	}, [selector]);

	// Pass the ref to your custom hook
	useHeaderBehavior({ headerRef });

	// No visible markup is rendered
	return null;
};

export default HeaderBehavior;
