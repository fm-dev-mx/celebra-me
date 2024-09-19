import React from 'react';
import { Accordion } from './Accordion';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQListProps {
    questions: FAQItem[];
	color?: string;
}

export const FAQList: React.FC<FAQListProps> = ({ questions, color }) => {
    return (
        <div className={`w-full max-w-3xl mx-auto text-${color}-dark mb-10`}>
            <Accordion items={questions} color={color} />
        </div>
    );
};

export default FAQList;
