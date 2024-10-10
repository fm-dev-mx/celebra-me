import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { TestimonialsData, Testimonial } from "@/config/landingPage.interface";
import Card from "./Card";

// Helper function to shuffle an array randomly
const shuffleArray = <T,>(array: T[]): T[] => {
	return array.sort(() => Math.random() - 0.5);
};

// Individual testimonial card component
const TestimonialCard: React.FC<{ testimonial: Testimonial; isActive: boolean }> = React.memo(
	({ testimonial, isActive }) => (
		<Card
			padding="p-8"
			hover="hover:brightness-105 hover:shadow-2xl"
			borderColor="border-secondary-dark/60 hover:brightness-110"
			opacity={isActive ? "opacity-100" : "opacity-70"}
			extraClass="content-center transition-all duration-300"
		>
			{/* Testimonial content */}
			<div className="flex-grow flex items-center justify-center">
				<p className="text-secondary-dark/90 italic text-md text-center line-clamp-4">
					"{testimonial.content}"
				</p>
			</div>
			{/* Author information */}
			<div className="mt-8 flex items-center justify-center">
				<div className="w-12 h-12 mr-4">
					<img
						src={`/images/testimonials/${testimonial.image}`}
						alt={`${testimonial.author}`}
						className="rounded-full object-cover w-full h-full"
					/>
				</div>
				<p className="font-semibold text-secondary-dark">{testimonial.author}</p>
			</div>
		</Card>
	),
);

// Set display name for debugging purposes
TestimonialCard.displayName = "TestimonialCard";

// Main TestimonialsCarousel component
const TestimonialsCarousel: React.FC<TestimonialsData> = ({ testimonials }) => {
	// Randomize testimonials on component mount or when data changes
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
		let interval: NodeJS.Timeout;
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
		<div className="relative w-full mx-auto my-12 px-4">
			{/* Carousel container */}
			<div className="flex justify-center items-center h-96">
				{visibleTestimonials.map((index, arrayIndex) => (
					<div
						key={randomizedTestimonials[index].id}
						className="absolute transition-all duration-300 max-w-[280px]"
						style={{
							transform: `translateX(${(arrayIndex - 1) * 110}%) scale(${
								index === currentIndex ? 1 : 0.8
							})`,
							opacity: index === currentIndex ? 1 : 0.5,
							zIndex: index === currentIndex ? 10 : 0,
							left: "50%",
							marginLeft: "-110px",
						}}
					>
						<TestimonialCard
							testimonial={randomizedTestimonials[index]}
							isActive={index === currentIndex}
						/>
					</div>
				))}
			</div>
			{/* Navigation buttons */}
			<button
				onClick={prevSlide}
				className="absolute left-1 md:left-4 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow-md text-secondary hover:bg-secondary-light hover:text-secondary-dark transition-colors duration-200 z-20"
				aria-label="Previous testimonial"
			>
				&#8249;
			</button>
			<button
				onClick={nextSlide}
				className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow-md text-secondary hover:bg-secondary-light hover:text-secondary-dark transition-colors duration-200 z-20"
				aria-label="Next testimonial"
			>
				&#8250;
			</button>
			{/* Autoplay toggle button */}
			<button
				onClick={() => setIsAutoPlaying((prev) => !prev)}
				className="absolute right-2 md:right-40 -translate-y-20 bg-white p-2 rounded-full shadow-md text-secondary hover:bg-secondary-light hover:text-secondary-dark transition-colors duration-200 z-20"
				aria-label={isAutoPlaying ? "Pause autoplay" : "Start autoplay"}
			>
				{isAutoPlaying ? "⏸" : "▶"}
			</button>
		</div>
	);
};

export default TestimonialsCarousel;
