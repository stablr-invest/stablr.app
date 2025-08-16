import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Shield, DollarSign, Lock } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const faqData: FAQItem[] = [
  {
    id: 'what-is-stablr',
    question: 'What is Stablr?',
    answer: 'Stablr is a yield aggregation platform that helps you discover and access the best stablecoin earning opportunities across multiple DeFi protocols and blockchains. We provide a unified interface to compare yields, risks, and easily deposit into protocols like Aave, Compound, Uniswap, and more - all while maintaining complete control of your funds.',
    icon: <HelpCircle className="h-5 w-5 text-blue-600" />
  },
  {
    id: 'fees',
    question: 'Does Stablr collect any fees?',
    answer: 'Yes, but only on your earnings, never on your principal. Stablr charges a 1% fee exclusively on interest earnings when you withdraw. For example, if you deposit $1,000 and earn $50 in interest, our fee would be $0.50 (1% of $50). Your original $1,000 principal is always 100% yours with no fees. This aligns our incentives with yours - we only succeed when you earn.',
    icon: <DollarSign className="h-5 w-5 text-green-600" />
  },
  {
    id: 'contract-risk',
    question: 'Do we expose our funds to additional Stablr contract risks?',
    answer: 'No! This is a key security feature of Stablr. When you deposit, your funds go directly to the underlying protocol (like Aave or Compound) through their official smart contracts. Stablr never holds, custodies, or controls your assets. We only facilitate the connection between you and these protocols. The only time you interact with a Stablr contract is during withdrawal to handle the small fee calculation, but your principal always remains in the original protocol.',
    icon: <Shield className="h-5 w-5 text-emerald-600" />
  },
  {
    id: 'how-it-works',
    question: 'How does the deposit and withdrawal process work?',
    answer: `Deposits: You connect your wallet and interact directly with the chosen protocol (e.g., Aave). Your funds are deposited straight into their smart contracts. 
    
Withdrawals: For withdrawals, we use two separate wallet transactions to maximize your security. The first transaction is a direct interaction with the withdrawal function of the underlying dApp, ensuring your funds are returned directly from the protocol. The second transaction is a small fee payment to Stablr, calculated only on your earnings.`,
    icon: <Lock className="h-5 w-5 text-purple-600" />
  },
  {
    id: 'supported-protocols',
    question: 'Which protocols and chains does Stablr support?',
    answer: 'Stablr aggregates opportunities from leading DeFi protocols, starting with Aave. Supported blockchains at launch include Ethereum, Arbitrum, Base, Polygon, Optimism, Avalanche and Linea. We continuously add new protocols and chains as we grow, always prioritizing user demand and security.',
    icon: <HelpCircle className="h-5 w-5 text-indigo-600" />
  },
  {
    id: 'security',
    question: 'How does Stablr ensure the security of my funds?',
    answer: `Security is our top priority. We achieve this through:
(1) Non-custodial architecture - your funds never touch Stablr contracts during deposits.
(2) Direct protocol interaction - you interact with audited, battle-tested protocols like Aave directly.
(3) Transparent operations - all transactions are on-chain and verifiable.`,
    icon: <Shield className="h-5 w-5 text-red-600" />
  }
];

export const FAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-2">
          <HelpCircle className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
      </div>

      <div className="space-y-4">
        {faqData.map((item) => (
          <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                {item.icon}
                <span className="font-medium text-slate-900">{item.question}</span>
              </div>
              {openItems.has(item.id) ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </button>
            
            {openItems.has(item.id) && (
              <div className="px-6 pb-4">
                <div className="pl-8 text-slate-700 leading-relaxed whitespace-pre-line">
                  {item.answer}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Section */}
      <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Still have questions?</h3>
        <p className="text-slate-600 text-sm mb-4">
          Our team is here to help you maximize your stablecoin yields safely and efficiently.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center space-x-2"
            onClick={() => window.open('https://x.com/stablrapp', '_blank', 'noopener,noreferrer')}
            type="button"
          >
            Drop us a question on X
          </button>
        </div>
      </div>
    </div>
  );
};