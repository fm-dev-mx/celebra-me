import React from 'react';

const WhatsAppButton: React.FC = () => {
  return (
    <button className="bg-green-500 text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-green-600">
      <span className="w-5 h-5 border border-current rounded-full flex items-center justify-center text-[10px]">W</span>
      WhatsApp
    </button>
  );
};

export default WhatsAppButton;
