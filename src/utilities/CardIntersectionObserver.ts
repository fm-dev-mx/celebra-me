// src/utilities/cardIntersectionObserver.ts
export function initializeCardIntersectionObserver() {
	let x = 0,
		y = 0;
	console.log("card observer effect: " + x++);
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
		console.log("observerCallback: " + y++);
		// Iterate over each card.
		entries.forEach((entry) => {
			console.log("entry: " + x++);
			const card = entry.target as HTMLElement;
			const action = card.querySelector(".pricing-card-cta");
			const title = card.querySelector(".pricing-card-title");
			const subtitle = card.querySelector(".pricing-card-subtitle");
			const texts = card.querySelectorAll(".pricing-card-text"); // Use querySelectorAll to get a NodeList

			// Add or remove hover effects based on element visibility.
			if (entry.isIntersecting) {
				console.log("si se activa el observador de la tarjeta");
				card.classList.add("pricing-card-hovered");
				if (action) action.classList.add("pricing-card-cta-hovered");
				if (title) title.classList.add("pricing-card-title-hovered");
				if (subtitle) subtitle.classList.add("pricing-card-subtitle-hovered");
				texts.forEach((text) => text.classList.add("pricing-card-text-hovered")); // Add hover effect to all text elements
			} else {
				console.log("si se desactiva el observador de la tarjeta");
				card.classList.remove("pricing-card-hovered");
				if (action) action.classList.remove("pricing-card-cta-hovered");
				if (title) title.classList.remove("pricing-card-title-hovered");
				if (subtitle) subtitle.classList.remove("pricing-card-subtitle-hovered");
				texts.forEach((text) => text.classList.remove("pricing-card-text-hovered")); // Remove hover effect from all text elements
			}
		});
	};

	// Create and apply the Intersection Observer to each card.
	const observer = new IntersectionObserver(observerCallback, observerOptions);
	cards.forEach((card) => observer.observe(card));
}
