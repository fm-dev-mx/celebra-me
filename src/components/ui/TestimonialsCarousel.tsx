import React from 'react';

interface Props {
  title: string;
  testimonials: Array<{
    name: string;
    text: string;
    role?: string;
  }>;
}

const TestimonialsCarousel: React.FC<Props> = ({ testimonials = [] }) => {
  return (
    <div className="flex overflow-x-auto gap-6 py-8">
      {testimonials.map((t, i) => (
        <div key={i} className="min-w-[300px] bg-white p-6 rounded-lg shadow-sm italic">
          <p>"{t.text}"</p>
          <p className="mt-4 font-bold not-italic">{t.name}</p>
        </div>
      ))}
    </div>
  );
};

export default TestimonialsCarousel;
