// src/frontend/hooks/header/useActivePath.ts

import { useState, useEffect } from 'react';

/**
 * useActivePath Hook
 *
 * Tracks the current URL path, updating whenever the user navigates,
 * including pushState and replaceState events.
 *
 * @returns {string} The current path (e.g. "/home", "/about", etc.).
 */
const useActivePath = (): string => {
	const [currentPath, setCurrentPath] = useState('');

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const updatePath = () => setCurrentPath(window.location.pathname);

			// Initial path
			updatePath();

			// Handle browser navigation
			window.addEventListener('popstate', updatePath);

			// Override pushState and replaceState to detect route changes
			const originalPushState = window.history.pushState;
			const originalReplaceState = window.history.replaceState;

			window.history.pushState = function (...args) {
				originalPushState.apply(this, args);
				updatePath();
			};

			window.history.replaceState = function (...args) {
				originalReplaceState.apply(this, args);
				updatePath();
			};

			// Cleanup
			return () => {
				window.removeEventListener('popstate', updatePath);
				window.history.pushState = originalPushState;
				window.history.replaceState = originalReplaceState;
			};
		}
	}, []);

	return currentPath;
};

export default useActivePath;
