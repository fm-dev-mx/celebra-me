document.addEventListener("DOMContentLoaded", function () {
	const cards = document.querySelectorAll(".bg-button-hover");

	cards.forEach((card) => {
		const action = card.querySelector(".card-action");

		// Hover effect for desktop
		card.addEventListener("mouseenter", function () {
			card.classList.add("action-hovered");
			if (action) action.classList.add("action-hovered");
		});

		card.addEventListener("mouseleave", function () {
			card.classList.remove("action-hovered");
			if (action) action.classList.remove("action-hovered");
		});

		// Intersection Observer for mobile
		const observerOptions: IntersectionObserverInit = {
			root: null,
			rootMargin: "0px",
			threshold: 0.5,
		};

		const observerCallback: IntersectionObserverCallback = (entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					card.classList.add("action-hovered");
					if (action) action.classList.add("action-hovered");
				} else {
					card.classList.remove("action-hovered");
					if (action) action.classList.remove("action-hovered");
				}
			});
		};

		const observer = new IntersectionObserver(observerCallback, observerOptions);
		observer.observe(card);
	});
});
