// src/utilities/CardHoverEffects.ts
export function initializeCardHoverEffects() {
	// Select all elements with the class '.card-effect'.
	const cards = document.querySelectorAll(".pricing-card");
	// Iterate over each card.
	cards.forEach((card) => {
		// Find specific child elements for hover effects.
		const action = card.querySelector(".pricing-card-cta");
		const title = card.querySelector(".pricing-card-title");
		const subtitle = card.querySelector(".pricing-card-subtitle");
		const price = card.querySelector(".pricing-card-price");
		const texts = card.querySelectorAll(".pricing-card-text"); // Use querySelectorAll to get a NodeList
		const bulletText = card.querySelectorAll(".pricing-card-bullet-text");
		const bulletIcon = card.querySelectorAll(".pricing-card-bullet-icon");

		// Add hover effects when mouse enters the card.
		card.addEventListener("mouseenter", function () {
			card.classList.add("pricing-card-hovered");
			if (action) action.classList.add("pricing-card-cta-hovered");
			if (title) title.classList.add("pricing-card-title-hovered");
			if (subtitle) subtitle.classList.add("pricing-card-subtitle-hovered");
			if (price) price.classList.add("pricing-card-price-hovered");
			texts.forEach((text) => text.classList.add("pricing-card-text-hovered")); // Add hover effect to all text elements
			bulletText.forEach((text) => text.classList.add("pricing-card-bullet-text-hovered"));
			bulletIcon.forEach((text) => text.classList.add("pricing-card-bullet-icon-hovered"));
		});

		// Remove hover effects when mouse leaves the card.
		card.addEventListener("mouseleave", function () {
			card.classList.remove("pricing-card-hovered");
			if (action) action.classList.remove("pricing-card-cta-hovered");
			if (title) title.classList.remove("pricing-card-title-hovered");
			if (subtitle) subtitle.classList.remove("pricing-card-subtitle-hovered");
			if (price) price.classList.remove("pricing-card-price-hovered");
			texts.forEach((text) => text.classList.remove("pricing-card-text-hovered")); // Remove hover effect from all text elements
			bulletText.forEach((text) => text.classList.remove("pricing-card-bullet-text-hovered"));
			bulletIcon.forEach((text) => text.classList.remove("pricing-card-bullet-icon-hovered"));
		});
	});
}
