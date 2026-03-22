import { useEffect } from 'react';

/**
 * Behavior-only component that adds a subtle parallax effect on mouse move
 * for the Hero section.
 */
export default function HeroParallaxBehavior() {
	useEffect(() => {
		const hero = document.getElementById('inicio');
		if (!hero) return;

		const bg = hero.querySelector('.parallax-bg');
		if (!bg) return;

		const handleMouseMove = (e: MouseEvent) => {
			const { clientX, clientY } = e;
			const { innerWidth, innerHeight } = window;

			// Calculate movement (subtle)
			const moveX = (clientX - innerWidth / 2) / 50;
			const moveY = (clientY - innerHeight / 2) / 50;

			// Apply transform to the image/video within the bg div
			const media = bg.querySelectorAll('img, video');
			media.forEach((el) => {
				(el as HTMLElement).style.transform =
					`scale(1.1) translate(${moveX}px, ${moveY}px)`;
			});
		};

		const handleMouseLeave = () => {
			const media = bg.querySelectorAll('img, video');
			media.forEach((el) => {
				(el as HTMLElement).style.transform = `scale(1.1) translate(0, 0)`;
			});
		};

		hero.addEventListener('mousemove', handleMouseMove);
		hero.addEventListener('mouseleave', handleMouseLeave);

		return () => {
			hero.removeEventListener('mousemove', handleMouseMove);
			hero.removeEventListener('mouseleave', handleMouseLeave);
		};
	}, []);

	return null;
}
