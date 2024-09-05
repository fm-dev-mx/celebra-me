// src/hooks/useHeaderScroll.ts
import { useEffect } from "react";

/**
 * Hook that manages the scroll, hover behavior of the header,
 * and highlights the menu link based on the section currently in view.
 */
export function useHeaderScroll() {
	useEffect(() => {
		// Track the last scroll position, header visibility state, and hover-triggered state.
		let lastScrollTop = 0;
		let isHeaderVisible = true;
		let appearedByMouse = false;

		// Retrieve the main header, its inner container, the mobile menu elements, and all sections.
		const header = document.getElementById("main-header");
		const headerContainer = header?.querySelector(".relative");
		const mobileMenu = document.getElementById("mobile-menu");
		const mobileMenuLinks = document.querySelectorAll("#mobile-menu a");
		const sections = document.querySelectorAll("section");

		// Early return if header elements are not found.
		if (!header || !headerContainer) return;

		/**
		 * Function to handle the scroll event.
		 * Toggles the visibility of the header based on the scroll direction
		 * and smoothly hides the mobile menu if it is open.
		 */
		function handleScroll() {
			// Obtain the current vertical scroll position.
			const scrollTop = window.scrollY || document.documentElement.scrollTop;
			// Calculate the scroll distance since the last event.
			const scrollDelta = scrollTop - lastScrollTop;

			// Hide the header when scrolling down and it's currently visible.
			if (scrollDelta > 0 && isHeaderVisible) {
				headerContainer?.classList.remove("opacity-100", "translate-y-0");
				headerContainer?.classList.add("opacity-0", "-translate-y-full");
				isHeaderVisible = false;
				appearedByMouse = false;

				// Close the mobile menu with fade-out effect if open while scrolling down.
				if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
					mobileMenu.classList.add("fade-out");
					setTimeout(() => {
						mobileMenu.classList.add("hidden");
						mobileMenu.classList.remove("fade-out");
					}, 300); // Match transition duration for smooth effect.
				}
			} else if (scrollDelta < 0 && !isHeaderVisible) {
				// Show the header when scrolling up and it's currently hidden.
				headerContainer?.classList.remove("opacity-0", "-translate-y-full");
				headerContainer?.classList.add("opacity-100", "translate-y-0");
				isHeaderVisible = true;
				appearedByMouse = false;
			}

			// Update the last scroll position to the current scroll position.
			lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
		}

		/**
		 * Function to handle mouseover events, making the header visible when the mouse hovers over it.
		 */
		function handleMouseOver() {
			if (!isHeaderVisible) {
				headerContainer?.classList.remove("opacity-0", "-translate-y-full");
				headerContainer?.classList.add("opacity-100", "translate-y-0");
				isHeaderVisible = true;
				appearedByMouse = true;
			}
		}

		/**
		 * Function to handle mouseleave events, hiding the header only if it appeared due to mouse hover.
		 */
		function handleMouseLeave() {
			if (isHeaderVisible && appearedByMouse) {
				headerContainer?.classList.remove("opacity-100", "translate-y-0");
				headerContainer?.classList.add("opacity-0", "-translate-y-full");
				isHeaderVisible = false;
				appearedByMouse = false;
			}
		}

		/**
		 * Function to observe sections and highlight the corresponding menu link.
		 * Uses Intersection Observer API to detect which section is currently visible.
		 */
		function highlightMenuLink(entries: IntersectionObserverEntry[]) {
			entries.forEach((entry) => {
				const link = document.querySelector(
					`#main-header nav a[href="#${entry.target.id}"]`
				);
				const mobileLink = document.querySelector(
					`#mobile-menu a[href="#${entry.target.id}"]`
				);

				if (entry.isIntersecting) {
					if (link) link.classList.add("text-primary-dark");
					if (mobileLink) mobileLink.classList.add("text-primary-dark");
				} else {
					if (link) link.classList.remove("text-primary-dark");
					if (mobileLink) mobileLink.classList.remove("text-primary-dark");
				}
			});
		}

		// Create an Intersection Observer to track visibility of each section.
		const observer = new IntersectionObserver(highlightMenuLink, {
			root: null,
			rootMargin: "-10% 0px -10% 0px",
			threshold: 0.2,
		});

		// Attach observer to each section.
		sections.forEach((section) => {
			observer.observe(section);
		});

		// Attach event listeners for scroll, mouseover, and mouseleave to control header visibility.
		window.addEventListener("scroll", handleScroll);
		header.addEventListener("mouseover", handleMouseOver);
		header.addEventListener("mouseleave", handleMouseLeave);

		// Attach event listeners to mobile menu links to hide the menu on click.
		mobileMenuLinks.forEach((link) => {
			link.addEventListener("click", () => {
				mobileMenu?.classList.add("fade-out");
				setTimeout(() => {
					mobileMenu?.classList.add("hidden");
					mobileMenu?.classList.remove("fade-out");
				}, 300);
			});
		});

		// Cleanup to avoid memory leaks.
		return () => {
			window.removeEventListener("scroll", handleScroll);
			header.removeEventListener("mouseover", handleMouseOver);
			header.removeEventListener("mouseleave", handleMouseLeave);
			sections.forEach((section) => observer.unobserve(section));
			mobileMenuLinks.forEach((link) => {
				link.removeEventListener("click", () => {
					mobileMenu?.classList.add("fade-out");
					setTimeout(() => {
						mobileMenu?.classList.add("hidden");
						mobileMenu?.classList.remove("fade-out");
					}, 300);
				});
			});
		};
	}, []); // Runs only once when the component is mounted.
}
