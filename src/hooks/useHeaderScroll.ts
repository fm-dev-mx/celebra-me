import { useEffect } from "react";

/**
 * Hook that handles the scroll behavior of the header.
 * The header will hide when scrolling down and show when scrolling up.
 * The background and shadow are adjusted based on scroll position.
 * The mobile menu will also be closed if it is open after a slight scroll.
 */
export function useHeaderScroll() {
	// useEffect ensures that the scroll handling logic is only run on the client
	// after the component has been mounted.
	useEffect(() => {
		// Variables to keep track of the last scroll position, scroll distance, and header visibility.
		let lastScrollTop = 0;
		let isHeaderVisible = true;
		const scrollThreshold = 10;  // Minimum scroll distance in pixels to trigger the menu close.

		// Retrieve the header element by its ID, the container within the header, and the mobile menu.
		const header = document.getElementById("main-header");
		const headerContainer = header?.querySelector(".relative");
		const mobileMenu = document.getElementById("mobile-menu");

		/**
		 * Handles the scroll event. This function toggles the visibility of the header
		 * based on the scroll direction and adjusts the header's background and shadow
		 * depending on the scroll position. It also closes the mobile menu if it is open
		 * after the user scrolls past a certain threshold.
		 */
		function handleScroll() {
			// If the header or container is not found, exit the function early.
			if (!header || !headerContainer) return;

			// Get the current scroll position.
			const scrollTop = window.scrollY || document.documentElement.scrollTop;
			// Calculate the difference between the current and last scroll positions.
			const scrollDelta = scrollTop - lastScrollTop;

			// Hide the header when scrolling down, and it's currently visible.
			if (scrollDelta > 0 && isHeaderVisible) {
				headerContainer.classList.remove("opacity-100", "translate-y-0");
				headerContainer.classList.add("opacity-0", "-translate-y-full");
				isHeaderVisible = false;
			}
			// Show the header when scrolling up, and it's currently hidden.
			else if (scrollDelta < 0 && !isHeaderVisible) {
				headerContainer.classList.remove("opacity-0", "-translate-y-full");
				headerContainer.classList.add("opacity-100", "translate-y-0");
				isHeaderVisible = true;
			}

			// When at the top of the page, make the header transparent.
			if (scrollTop === 0) {
				headerContainer.classList.remove("bg-white/80", "shadow-lg", "backdrop-blur-sm");
				headerContainer.classList.add("bg-transparent");
			}
			// Otherwise, apply a background and shadow to the header.
			else {
				headerContainer.classList.add("bg-white/80", "shadow-lg", "backdrop-blur-sm");
				headerContainer.classList.remove("bg-transparent");
			}

			// Close the mobile menu if it's open and the scroll exceeds the threshold.
			if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
				// If the user scrolls down by more than the threshold, close the mobile menu.
				if (Math.abs(scrollDelta) > scrollThreshold) {
					mobileMenu.classList.add("opacity-0", "transform", "scale-95"); // Add smooth transition classes
					setTimeout(() => {
						mobileMenu.classList.add("hidden"); // Hide after the transition
						mobileMenu.classList.remove("opacity-0", "transform", "scale-95"); // Clean up transition classes
					}, 300); // Match with the transition duration
				}
			}

			// Update the last scroll position for the next scroll event.
			lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
		}

		/**
		 * Throttle function to limit the rate at which the handleScroll function is called.
		 * This helps improve performance by reducing the number of times the function is executed
		 * during continuous scrolling.
		 *
		 * @param callback - The function to be throttled.
		 * @param limit - The time limit (in milliseconds) to throttle the function.
		 */
		function throttle(callback: Function, limit: number) {
			let waiting = false;
			return (...args: any[]): void => {
				if (!waiting) {
					callback(...args);
					waiting = true;
					setTimeout(() => {
						waiting = false;
					}, limit);
				}
			};
		}

		// Create a throttled version of the handleScroll function to improve performance.
		const throttledScroll = throttle(handleScroll, 100);

		// Attach the throttled scroll event listener to the window.
		window.addEventListener("scroll", throttledScroll);

		// Clean up the event listener when the component is unmounted to prevent memory leaks.
		return () => {
			window.removeEventListener("scroll", throttledScroll);
		};
	}, []); // Empty dependency array ensures this effect runs only once on mount.
}
