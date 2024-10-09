// src/utilities/cardIntersectionObserver.ts
export function initializeCardIntersectionObserver() {
	// Select all elements with the class '.card-effect'.
	const cards = document.querySelectorAll(".pricing-card");

	// Configuration for the Intersection Observer.
	const observerOptions = {
		root: null, // Observe changes in relation to the viewport
		rootMargin: "0px",
		threshold: 0.7, // Trigger when 85% of the target is visible
	};

	// Callback for handling intersection changes.
	const observerCallback = (entries: IntersectionObserverEntry[]) => {
		// Iterate over each card.
		entries.forEach((entry) => {
			const card = entry.target as HTMLElement;
			const action = card.querySelector(".pricing-card-cta");
			const title = card.querySelector(".pricing-card-title");
			const subtitle = card.querySelector(".pricing-card-subtitle");
			const price = card.querySelector(".pricing-card-price");
			const texts = card.querySelectorAll(".pricing-card-text"); // Use querySelectorAll to get a NodeList
			const bulletText = card.querySelectorAll(".pricing-card-bullet-text");
			const bulletIcon = card.querySelectorAll(".pricing-card-bullet-icon");
			const cta = card.querySelector(".pricing-card-cta");

			// Add or remove hover effects based on element visibility.
			if (entry.isIntersecting) {
				card.classList.add("pricing-card-hovered");
				if (action) action.classList.add("pricing-card-cta-hovered");
				if (title) title.classList.add("pricing-card-title-hovered");
				if (subtitle) subtitle.classList.add("pricing-card-subtitle-hovered");
				if (price) price.classList.add("pricing-card-price-hovered");
				texts.forEach((text) => text.classList.add("pricing-card-text-hovered")); // Add hover effect to all text elements
				bulletText.forEach((text) => text.classList.add("pricing-card-bullet-text-hovered"));
				bulletIcon.forEach((icon) => icon.classList.add("pricing-card-bullet-icon-hovered"));
				if (cta) cta.classList.add("pricing-card-cta-intersected");
			} else {
				card.classList.remove("pricing-card-hovered");
				if (action) action.classList.remove("pricing-card-cta-hovered");
				if (title) title.classList.remove("pricing-card-title-hovered");
				if (subtitle) subtitle.classList.remove("pricing-card-subtitle-hovered");
				if (price) price.classList.remove("pricing-card-price-hovered");
				texts.forEach((text) => text.classList.remove("pricing-card-text-hovered")); // Remove hover effect from all text elements
				bulletText.forEach((text) => text.classList.remove("pricing-card-bullet-text-hovered"));
				bulletIcon.forEach((icon) => icon.classList.remove("pricing-card-bullet-icon-hovered"));
				if (cta) cta.classList.remove("pricing-card-cta-intersected");
			}
		});
	};

	// Create and apply the Intersection Observer to each card.
	const observer = new IntersectionObserver(observerCallback, observerOptions);
	cards.forEach((card) => observer.observe(card));
}
