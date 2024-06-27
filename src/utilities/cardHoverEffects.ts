// src/utilities/cardHoverEffects.ts
export function initializeCardHoverEffects() {
	// Select all elements with the class '.card-effect'.
	const cards = document.querySelectorAll(".card-effect");

	// Iterate over each card.
	cards.forEach((card) => {
		// Find specific child elements for hover effects.
		const action = card.querySelector(".card-action-effect");
		const title = card.querySelector(".card-title-effect");
		const subtitle = card.querySelector(".card-subtitle-effect");
		const texts = card.querySelectorAll(".card-text-effect"); // Use querySelectorAll to get a NodeList

		// Add hover effects when mouse enters the card.
		card.addEventListener("mouseenter", function () {
			card.classList.add("card-effect-hovered");
			if (action) action.classList.add("card-action-effect-hovered");
			if (title) title.classList.add("card-title-effect-hovered");
			if (subtitle) subtitle.classList.add("card-subtitle-effect-hovered");
			texts.forEach((text) => text.classList.add("card-text-effect-hovered")); // Add hover effect to all text elements
		});

		// Remove hover effects when mouse leaves the card.
		card.addEventListener("mouseleave", function () {
			card.classList.remove("card-effect-hovered");
			if (action) action.classList.remove("card-action-effect-hovered");
			if (title) title.classList.remove("card-title-effect-hovered");
			if (subtitle) subtitle.classList.remove("card-subtitle-effect-hovered");
			texts.forEach((text) => text.classList.remove("card-text-effect-hovered")); // Remove hover effect from all text elements
		});
	});
}
