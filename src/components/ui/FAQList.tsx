import React from 'react';

interface Props {
  faqs: Array<{ question: string; answer: string }>;
  color?: string;
}

const FAQList: React.FC<Props> = ({ faqs = [] }) => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      {faqs.map((faq, i) => (
        <div key={i} className="mb-6 border-b pb-4">
          <h4 className="text-xl font-bold mb-2">{faq.question}</h4>
          <p className="text-gray-600">{faq.answer}</p>
        </div>
      ))}
    </div>
  );
};

export default FAQList;
