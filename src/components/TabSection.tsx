import React, { useState } from 'react';
import { FAQ } from './FAQ';
import { Roadmap } from './Roadmap';

export const TabSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'faq' | 'roadmap'>('faq');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Tab Headers */}
      <div className="border-b border-slate-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'faq'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Frequently Asked Questions
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'roadmap'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Stablr Roadmap
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-0">
        {activeTab === 'faq' && <FAQ />}
        {activeTab === 'roadmap' && <Roadmap />}
      </div>
    </div>
  );
};