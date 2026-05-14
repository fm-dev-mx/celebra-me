export function initInterludeObserver(): void {
	const interludes = Array.from(document.querySelectorAll('.invitation-interlude'));

	if (interludes.length === 0) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	interludes.forEach((interlude) => {
		if (interlude instanceof HTMLElement) {
			interlude.style.setProperty(
				'--interlude-focal-point',
				interlude.dataset.focalPoint || 'center',
			);
			interlude.style.setProperty('--interlude-light-x', interlude.dataset.lightX || '50%');
			interlude.style.setProperty('--interlude-light-y', interlude.dataset.lightY || '34%');
			interlude.style.setProperty(
				'--interlude-overlay-opacity',
				interlude.dataset.overlayOpacity || '18%',
			);
		}
	});

	if (prefersReducedMotion) {
		interludes.forEach((interlude) => {
			if (interlude instanceof HTMLElement) {
				interlude.classList.add('is-visible');
			}
		});
		return;
	}

	const isMobile = window.innerWidth <= 768;
	const parallaxInterludes = isMobile
		? []
		: interludes.filter((interlude): interlude is HTMLElement => {
				return interlude instanceof HTMLElement;
			});

	let ticking = false;

	const updateParallax = () => {
		for (const interlude of parallaxInterludes) {
			const variant = interlude.dataset.variant || 'standard';
			const rect = interlude.getBoundingClientRect();
			const viewportCenter = window.innerHeight / 2;
			const parallaxStrength = variant === 'premiere-standard' ? -0.045 : -0.08;
			const offset = (rect.top + rect.height / 2 - viewportCenter) * parallaxStrength;

			interlude.style.setProperty('--interlude-parallax-offset', `${offset.toFixed(2)}px`);
		}

		ticking = false;
	};

	const requestParallaxUpdate = () => {
		if (ticking) return;
		ticking = true;
		window.requestAnimationFrame(updateParallax);
	};

	if (parallaxInterludes.length > 0) {
		requestParallaxUpdate();
		window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
		window.addEventListener('resize', requestParallaxUpdate);
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					observer.unobserve(entry.target);
				}
			}
		},
		{ threshold: 0.15 },
	);

	interludes.forEach((el) => observer.observe(el));
}
