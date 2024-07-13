import React, { useEffect, useRef } from "react";
import Glide from "@glidejs/glide/dist/glide.esm";
import "@glidejs/glide/dist/css/glide.core.min.css";
import "@glidejs/glide/dist/css/glide.theme.min.css";
import type { TestimonialsData, Testimonial } from "@/config/landing.interface";

// Component for an individual testimonial slide
const TestimonialSlide: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => (
	<div className="glide__slide">
		<div className="bg-white px-16 py-6 rounded-xl shadow-xl max-w-md h-44 border-dotted border-primary-light border-2 flex flex-col justify-between">
			<p className="text-primary-dark/80 italic mb-4">"{testimonial.content}"</p>
			<div className="flex items-center">
				<img
					src={testimonial.image}
					alt={`Photo of ${testimonial.author}`}
					className="w-12 h-12 rounded-full mr-4 object-cover"
				/>
				<p className="font-semibold text-primary-dark">{testimonial.author}</p>
			</div>
		</div>
	</div>
);

const TestimonialsCarousel: React.FC<TestimonialsData> = ({ testimonials: testimonials }) => {
	const glideRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (glideRef.current) {
			// Initialize Glide.js with optimized settings
			const glide = new Glide(glideRef.current, {
				type: "carousel",
				perView: 3,
				focusAt: "center",
				gap: 30,
				autoplay: 5000,
				hoverpause: true,
				animationDuration: 1000,
				animationTimingFunc: "cubic-bezier(0.165, 0.840, 0.440, 1.000)",
				breakpoints: {
					1024: { perView: 3 },
					640: { perView: 1 },
				},
			});

			glide.mount();

			// Cleanup function to destroy Glide instance on component unmount
			return () => glide.destroy();
		}
	}, []);

	return (
		<div ref={glideRef} className="glide w-full max-w-6xl mx-auto my-12 h-80 place-content-center">
			<div className="glide__track h-52" data-glide-el="track">
				<ul className="glide__slides h-80">
					{testimonials.map((testimonial: Testimonial, index: number) => (
						<li key={index} className="h-40 py-2">
							<TestimonialSlide testimonial={testimonial} />
						</li>
					))}
				</ul>
			</div>
			<div className="glide__arrows flex justify-center" data-glide-el="controls">
				<button
					className="glide__arrow glide__arrow--left p-2 rounded-full mr-10 text-primary-default border-primary-dark"
					data-glide-dir="<"
					aria-label="Previous slide"
				>
					&lt;
				</button>
				<button
					className="glide__arrow glide__arrow--right bg-primary p-2 rounded-full ml-10 focus:outline-none focus:ring-2 focus:ring-primary"
					data-glide-dir=">"
					aria-label="Next slide"
				>
					&gt;
				</button>
			</div>
		</div>
	);
};

export default TestimonialsCarousel;
