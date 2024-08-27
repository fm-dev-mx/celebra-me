import { useEffect } from "react";

/**
 * Hook to manage the mobile menu toggle behavior.
 * Attaches an event listener to the mobile menu button to toggle the menu visibility.
 */
export function useMobileMenu() {
	useEffect(() => {
		// Get the mobile menu button and menu elements by their IDs.
		const menuButton = document.getElementById("mobile-menu-button");
		const mobileMenu = document.getElementById("mobile-menu");

		/**
		 * Function to toggle the visibility of the mobile menu.
		 * Adds or removes the "hidden" class from the mobile menu element.
		 */
		function toggleMobileMenu() {
			if (mobileMenu) {
				mobileMenu.classList.toggle("hidden");
			}
		}

		// Attach the event listener to the mobile menu button.
		if (menuButton) {
			menuButton.addEventListener("click", toggleMobileMenu);
		}

		// Clean up the event listener when the component is unmounted.
		return () => {
			if (menuButton) {
				menuButton.removeEventListener("click", toggleMobileMenu);
			}
		};
	}, []); // Empty dependency array ensures this effect runs only once on mount.
}
