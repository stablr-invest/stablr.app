import React from 'react';
import { 
  CheckCircle, 
  Circle, 
  Rocket, 
  ArrowRightLeft, 
  Coins, 
  Gift, 
  Bot,
  Calendar,
  Target
} from 'lucide-react';

interface RoadmapItem {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  icon: React.ReactNode;
  features: string[];
  timeline: string;
}

const roadmapData: RoadmapItem[] = [
  {
    id: 'phase1',
    phase: 'Beta Launch',
    title: 'Core Lending Protocols',
    description: 'Launch with core lending protocols to provide yield opportunities for stablecoins.',
    status: 'completed',
    icon: <Rocket className="h-6 w-6" />,
    features: [
      'USDC and USDT lending pools',
      'Multi-chain support (Ethereum, Arbitrum, Base)',
      'Direct protocol interaction (non-custodial)'
    ],
    timeline: 'Q3 2025'
  },
  {
    id: 'phase2',
    phase: 'Phase 2',
    title: 'Cross-Chain Infrastructure',
    description: 'Add seamless swapping and bridging capabilities to optimize stablecoin positioning across chains.',
    status: 'in-progress',
    icon: <ArrowRightLeft className="h-6 w-6" />,
    features: [
      'Native USDC/USDT swapping via DEX aggregators',
      'Cross-chain bridging integration via Bridge aggregators',
      'Gas optimization for multi-chain operations',
      'Single-transaction cross-chain deposits and withdrawals'
    ],
    timeline: 'Q3 2025'
  },
  {
    id: 'phase3',
    phase: 'Phase 3',
    title: 'Liquidity Pool Opportunities',
    description: 'Expand to include USDC/USDT liquidity pool yields from major DEXs across all supported chains.',
    status: 'upcoming',
    icon: <Coins className="h-6 w-6" />,
    features: [
      'Stable pair pools (USDC/USDT)',
      'Fees and rewards claim from LPs'
    ],
    timeline: 'Q4 2025'
  },
  {
    id: 'phase4',
    phase: 'Phase 4',
    title: 'Airdrop Opportunities',
    description: 'Integrate stablecoin protocols with potential airdrops to maximize both yield and token rewards.',
    status: 'upcoming',
    icon: <Gift className="h-6 w-6" />,
    features: [
      'Airdrop-eligible protocol identification',
      'Points and rewards tracking',
      'Strategic positioning for airdrops',
      'Historical airdrop value analysis',
      'Risk/reward optimization for new protocols'
    ],
    timeline: 'Q4 2025'
  },
  {
    id: 'phase5',
    phase: 'Phase 5',
    title: 'AI Yield Optimization',
    description: 'Deploy AI agents for automated yield optimization based on user-defined portfolio parameters.',
    status: 'upcoming',
    icon: <Bot className="h-6 w-6" />,
    features: [
      'Automated rebalancing based on yield changes',
      'Gas-efficient transaction batching',
      'Risk tolerance customization',
      'Predictive yield modeling and positioning'
    ],
    timeline: 'Q4 2025'
  }
];

export const Roadmap: React.FC = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in-progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'upcoming': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress': return <div className="h-5 w-5 rounded-full bg-blue-600 animate-pulse" />;
      case 'upcoming': return <Circle className="h-5 w-5 text-slate-400" />;
      default: return <Circle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getIconColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'upcoming': return 'text-slate-600 bg-slate-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-2">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stablr Roadmap</h2>
          <p className="text-sm text-slate-600">Building the future of stablecoin yield optimization</p>
        </div>
      </div>

      <div className="space-y-8">
        {roadmapData.map((item, index) => (
          <div key={item.id} className="relative">
            {/* Connection Line */}
            {index < roadmapData.length - 1 && (
              <div className="absolute left-6 top-16 w-0.5 h-16 bg-slate-200"></div>
            )}
            
            <div className="flex items-start space-x-6">
              {/* Status Icon */}
              <div className="flex-shrink-0 relative">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIconColor(item.status)}`}>
                  {item.icon}
                </div>
                <div className="absolute -bottom-1 -right-1">
                  {getStatusIcon(item.status)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                      {item.phase}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-500">
                    <Calendar className="h-4 w-4" />
                    <span>{item.timeline}</span>
                  </div>
                </div>

                <p className="text-slate-700 mb-4 leading-relaxed">{item.description}</p>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {item.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                      <span className="text-sm text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Call to Action */}
      <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Follow us on X</h3>
            <p className="text-slate-600 text-sm">Get product updates, roadmap drops, and feature launches.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => window.open('https://x.com/intent/follow?screen_name=stablrapp', '_blank', 'noopener,noreferrer')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              Follow @stablrapp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};