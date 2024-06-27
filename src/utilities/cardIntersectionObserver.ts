// src/utilities/cardIntersectionObserver.ts
export function initializeCardIntersectionObserver() {
	// Select all elements with the class '.card-effect'.
	const cards = document.querySelectorAll(".card-effect");

	// Configuration for the Intersection Observer.
	const observerOptions = {
		root: null, // Observe changes in relation to the viewport
		rootMargin: "0px",
		threshold: 0.9, // Trigger when 50% of the target is visible
	};

	// Callback for handling intersection changes.
	const observerCallback = (entries: IntersectionObserverEntry[]) => {
		entries.forEach((entry) => {
			const card = entry.target as HTMLElement;
			const action = card.querySelector(".card-action-effect");
			const title = card.querySelector(".card-title-effect");
			const subtitle = card.querySelector(".card-subtitle-effect");
			const texts = card.querySelectorAll(".card-text-effect"); // Use querySelectorAll to get a NodeList

			// Add or remove hover effects based on element visibility.
			if (entry.isIntersecting) {
				card.classList.add("card-effect-hovered");
				if (action) action.classList.add("card-action-effect-hovered");
				if (title) title.classList.add("card-title-effect-hovered");
				if (subtitle) subtitle.classList.add("card-subtitle-effect-hovered");
				texts.forEach((text) => text.classList.add("card-text-effect-hovered")); // Add hover effect to all text elements
			} else {
				card.classList.remove("card-effect-hovered");
				if (action) action.classList.remove("card-action-effect-hovered");
				if (title) title.classList.remove("card-title-effect-hovered");
				if (subtitle) subtitle.classList.remove("card-subtitle-effect-hovered");
				texts.forEach((text) => text.classList.remove("card-text-effect-hovered")); // Remove hover effect from all text elements
			}
		});
	};

	// Create and apply the Intersection Observer to each card.
	const observer = new IntersectionObserver(observerCallback, observerOptions);
	cards.forEach((card) => observer.observe(card));
}
