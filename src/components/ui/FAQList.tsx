import React from 'react';
import { Accordion } from './Accordion';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQListProps {
    questions: FAQItem[];
}

export const FAQList: React.FC<FAQListProps> = ({ questions }) => {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <Accordion items={questions} />
        </div>
    );
};

export default FAQList;
