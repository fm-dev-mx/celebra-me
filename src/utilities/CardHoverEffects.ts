// src/utilities/CardHoverEffects.ts
export function initializeCardHoverEffects() {
	let x = 0,
		y = 0;
	// Select all elements with the class '.card-effect'.
	const cards = document.querySelectorAll(".pricing-card");
	console.log("card hover effect: " + x++);
	// Iterate over each card.
	cards.forEach((card) => {
		console.log("card: " + y++);
		// Find specific child elements for hover effects.
		const action = card.querySelector(".pricing-card-cta");
		const title = card.querySelector(".pricing-card-title");
		const subtitle = card.querySelector(".pricing-card-subtitle");
		const texts = card.querySelectorAll(".pricing-card-text"); // Use querySelectorAll to get a NodeList
		const bulletText = card.querySelectorAll(".pricing-card-bullet-text");

		// Add hover effects when mouse enters the card.
		card.addEventListener("mouseenter", function () {
			console.log("si se activa el hover de la tarjeta");
			card.classList.add("pricing-card-hovered");
			if (action) action.classList.add("pricing-card-cta-hovered");
			if (title) title.classList.add("pricing-card-title-hovered");
			if (subtitle) subtitle.classList.add("pricing-card-subtitle-hovered");
			texts.forEach((text) => text.classList.add("pricing-card-text-hovered")); // Add hover effect to all text elements
			bulletText.forEach((text) => text.classList.add("pricing-card-bullet-text-hovered"));
		});

		// Remove hover effects when mouse leaves the card.
		card.addEventListener("mouseleave", function () {
			console.log("si se desactiva el hover de la tarjeta");
			card.classList.remove("pricing-card-hovered");
			if (action) action.classList.remove("pricing-card-cta-hovered");
			if (title) title.classList.remove("pricing-card-title-hovered");
			if (subtitle) subtitle.classList.remove("pricing-card-subtitle-hovered");
			texts.forEach((text) => text.classList.remove("pricing-card-text-hovered")); // Remove hover effect from all text elements
			bulletText.forEach((text) => text.classList.remove("pricing-card-bullet-text-hovered"));
		});
	});
}
