import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { TestimonialsData, Testimonial } from "@/config/landing.interface";

// Helper function to shuffle an array randomly
const shuffleArray = (array: any[]) => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

// Individual testimonial card component
const TestimonialCard: React.FC<{ testimonial: Testimonial; isActive: boolean }> = React.memo(({ testimonial, isActive }) => (
  <div
    className={`bg-white px-6 py-6 rounded-xl shadow-lg border-2 border-primary-light flex flex-col transition-all duration-300 hover:shadow-xl ${isActive ? 'opacity-100' : 'opacity-70'}`}
    style={{ width: '250px', height: '220px' }}
  >
    <div className="flex flex-col h-full">
      <div className="flex-grow flex items-center justify-center">
        <p className="text-primary-dark/80 italic text-md text-center line-clamp-4">"{testimonial.content}"</p>
      </div>
      <div className="mt-4 flex items-center justify-center">
        <img
          src={testimonial.image}
          alt={`Photo of ${testimonial.author}`}
          className="w-12 h-12 rounded-full mr-4 object-cover"
        />
        <p className="font-semibold text-primary-dark">{testimonial.author}</p>
      </div>
    </div>
  </div>
));

TestimonialCard.displayName = "TestimonialCard";

// Main TestimonialsCarousel component
const TestimonialsCarousel: React.FC<TestimonialsData> = ({ testimonials }) => {
	// Randomize testimonials on component mount or when testimonials change
	const randomizedTestimonials = useMemo(() => shuffleArray(testimonials), [testimonials]);

	// State for current slide index and autoplay status
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isAutoPlaying, setIsAutoPlaying] = useState(true);

	// Function to move to the next slide
	const nextSlide = useCallback(() => {
		setCurrentIndex((prevIndex) => (prevIndex + 1) % randomizedTestimonials.length);
	}, [randomizedTestimonials.length]);

	// Function to move to the previous slide
	const prevSlide = useCallback(() => {
		setCurrentIndex(
			(prevIndex) =>
				(prevIndex - 1 + randomizedTestimonials.length) % randomizedTestimonials.length,
		);
	}, [randomizedTestimonials.length]);

	// Effect for autoplay functionality
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (isAutoPlaying) {
			interval = setInterval(nextSlide, 5000); // Change slide every 5 seconds
		}
		return () => clearInterval(interval); // Cleanup on component unmount or when autoplay is toggled off
	}, [isAutoPlaying, nextSlide]);

	// Function to get visible testimonials (previous, current, next)
	const getVisibleTestimonials = useCallback(() => {
		const prev =
			(currentIndex - 1 + randomizedTestimonials.length) % randomizedTestimonials.length;
		const next = (currentIndex + 1) % randomizedTestimonials.length;
		return [prev, currentIndex, next];
	}, [currentIndex, randomizedTestimonials.length]);

	// Get the currently visible testimonials
	const visibleTestimonials = getVisibleTestimonials();

	return (
		<div className="relative w-full max-w-7xl mx-auto my-12 px-4">
			<div className="overflow-hidden">
				<div className="flex justify-center transition-transform duration-500 ease-in-out">
					{visibleTestimonials.map((index) => (
						<div
							key={randomizedTestimonials[index].id}
							className="flex-shrink-0 px-2 transition-all duration-300"
							style={{ transform: `scale(${index === currentIndex ? 1 : 0.9})` }}
						>
							<TestimonialCard
								testimonial={randomizedTestimonials[index]}
								isActive={index === currentIndex}
							/>
						</div>
					))}
				</div>
			</div>
			{/* Navigation buttons */}
			<button
				onClick={prevSlide}
				className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow-md hover:bg-primary-light transition-colors duration-200 z-10"
				aria-label="Previous testimonial"
			>
				&#8249;
			</button>
			<button
				onClick={nextSlide}
				className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow-md hover:bg-primary-light transition-colors duration-200 z-10"
				aria-label="Next testimonial"
			>
				&#8250;
			</button>
			{/* Autoplay toggle button */}
			<button
				onClick={() => setIsAutoPlaying((prev) => !prev)}
				className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-md hover:bg-primary-light transition-colors duration-200"
				aria-label={isAutoPlaying ? "Pause autoplay" : "Start autoplay"}
			>
				{isAutoPlaying ? "⏸" : "▶"}
			</button>
		</div>
	);
};

export default TestimonialsCarousel;
