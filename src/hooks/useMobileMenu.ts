// src/hooks/useMobileMenu.ts
import { useEffect } from "react";

/**
 * Hook to manage the mobile menu toggle behavior with smooth transitions.
 * Adds or removes the "fade-in" and "fade-out" classes for entry and exit effects.
 */
export function useMobileMenu() {
	useEffect(() => {
		// Select the mobile menu button and menu elements by their IDs.
		const menuButton = document.getElementById("mobile-menu-button");
		const mobileMenu = document.getElementById("mobile-menu");

		/**
		 * Toggles the visibility of the mobile menu with transition effects.
		 * Uses the "fade-in" class for showing and "fade-out" for hiding.
		 */
		function toggleMobileMenu() {
			if (mobileMenu) {
				// Check if the menu is hidden and apply appropriate classes.
				const isHidden = mobileMenu.classList.contains("hidden");
				if (isHidden) {
					mobileMenu.classList.remove("hidden");
					requestAnimationFrame(() => {
						mobileMenu.classList.add("fade-in");
						mobileMenu.classList.remove("fade-out");
					});
				} else {
					mobileMenu.classList.add("fade-out");
					mobileMenu.classList.remove("fade-in");

					// Delay hiding the menu to match the transition duration.
					setTimeout(() => {
						mobileMenu.classList.add("hidden");
						mobileMenu.classList.remove("fade-out");
					}, 300); // Ensure this matches the CSS transition duration.
				}
			}
		}

		// Attach the click event listener to toggle the mobile menu.
		if (menuButton) {
			menuButton.addEventListener("click", toggleMobileMenu);
		}

		// Clean up the event listener on component unmount to prevent memory leaks.
		return () => {
			if (menuButton) {
				menuButton.removeEventListener("click", toggleMobileMenu);
			}
		};
	}, []); // Runs only once when the component is mounted.
}
