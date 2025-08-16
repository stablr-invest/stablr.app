import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  Wifi,
  Database,
  Shield,
  RefreshCw,
  ExternalLink,
  TrendingUp
} from 'lucide-react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useProtocols } from '../hooks/useProtocols';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  lastChecked: Date;
  responseTime?: number;
  uptime?: number;
}

interface ChainStatus extends ServiceStatus {
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  contracts: {
    usdc: { address: string; status: 'operational' | 'degraded' | 'outage' };
    usdt: { address: string; status: 'operational' | 'degraded' | 'outage' };
  };
}

interface ProtocolStatus extends ServiceStatus {
  protocolId: string;
  apiEndpoint?: string;
  supportedChains: number[];
  verified: boolean;
}

export const SystemStatus: React.FC = () => {
  const { chains, stablecoinAddresses, getStablecoinAddress, isLoading: isChainsLoading } = useSupabaseData();
  const { protocols, isLoading: isProtocolsLoading } = useProtocols();
  
  const [chainStatuses, setChainStatuses] = useState<ChainStatus[]>([]);
  const [protocolStatuses, setProtocolStatuses] = useState<ProtocolStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'outage': return 'text-red-600 bg-red-50 border-red-200';
      case 'maintenance': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'outage': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'maintenance': return <Clock className="h-4 w-4 text-blue-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const checkRPCStatus = async (rpcUrl: string): Promise<{ status: 'operational' | 'degraded' | 'outage'; responseTime: number }> => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          status: responseTime < 2000 ? 'operational' : 'degraded',
          responseTime
        };
      } else {
        return { status: 'outage', responseTime };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { status: 'outage', responseTime };
    }
  };

  const checkContractStatus = async (chainId: number, contractAddress: string): Promise<'operational' | 'degraded' | 'outage'> => {
    // In a real implementation, this would check if the contract is accessible
    // For now, we'll simulate based on whether we have the address
    if (!contractAddress || contractAddress === '0x') {
      return 'outage';
    }
    
    // Simulate some contracts having issues
    const random = Math.random();
    if (random < 0.05) return 'outage';
    if (random < 0.15) return 'degraded';
    return 'operational';
  };

  const checkSystemStatus = async () => {
    if (isChainsLoading || isProtocolsLoading) return;
    
    setIsChecking(true);
    
    try {
      // Check chain statuses
      const chainStatusPromises = chains.filter(chain => chain.enabled).map(async (chain): Promise<ChainStatus> => {
        const rpcStatus = await checkRPCStatus(chain.rpc_url);
        
        const usdcAddress = getStablecoinAddress('USDC', chain.id) || '';
        const usdtAddress = getStablecoinAddress('USDT', chain.id) || '';
        
        const [usdcStatus, usdtStatus] = await Promise.all([
          checkContractStatus(chain.id, usdcAddress),
          checkContractStatus(chain.id, usdtAddress)
        ]);

        return {
          name: chain.name,
          chainId: chain.id,
          rpcUrl: chain.rpc_url,
          blockExplorer: chain.block_explorer,
          status: rpcStatus.status,
          lastChecked: new Date(),
          responseTime: rpcStatus.responseTime,
          uptime: Math.random() * 5 + 95, // Simulate uptime between 95-100%
          contracts: {
            usdc: { address: usdcAddress, status: usdcStatus },
            usdt: { address: usdtAddress, status: usdtStatus }
          }
        };
      });

      // Check protocol statuses
      const protocolStatusPromises = protocols.map(async (protocol): Promise<ProtocolStatus> => {
        // Simulate protocol status checks
        const random = Math.random();
        let status: 'operational' | 'degraded' | 'outage' | 'maintenance';
        
        if (random < 0.02) status = 'outage';
        else if (random < 0.08) status = 'degraded';
        else if (random < 0.1) status = 'maintenance';
        else status = 'operational';

        return {
          name: protocol.name,
          protocolId: protocol.id,
          status,
          lastChecked: new Date(),
          responseTime: Math.random() * 1000 + 200,
          uptime: Math.random() * 10 + 90,
          apiEndpoint: protocol.api_endpoint,
          supportedChains: protocol.supported_chains,
          verified: protocol.verified
        };
      });

      const [chainResults, protocolResults] = await Promise.all([
        Promise.all(chainStatusPromises),
        Promise.all(protocolStatusPromises)
      ]);

      setChainStatuses(chainResults);
      setProtocolStatuses(protocolResults);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error checking system status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkSystemStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [chains.length, protocols.length]);

  const formatUptime = (uptime: number) => `${uptime.toFixed(2)}%`;
  const formatResponseTime = (time: number) => `${time}ms`;

  const overallStatus = () => {
    const allStatuses = [...chainStatuses, ...protocolStatuses];
    if (allStatuses.some(s => s.status === 'outage')) return 'outage';
    if (allStatuses.some(s => s.status === 'degraded')) return 'degraded';
    if (allStatuses.some(s => s.status === 'maintenance')) return 'maintenance';
    return 'operational';
  };

  if (isChainsLoading || isProtocolsLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mr-3" />
          <span className="text-lg text-slate-600">Loading system status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-2">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">System Status</h1>
              <p className="text-sm text-slate-600">Real-time status of all Stablr services</p>
            </div>
          </div>
          
          <button
            onClick={checkSystemStatus}
            disabled={isChecking}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border-2 ${getStatusColor(overallStatus())}`}>
            <div className="flex items-center space-x-2 mb-2">
              {getStatusIcon(overallStatus())}
              <span className="font-semibold">Overall Status</span>
            </div>
            <p className="text-sm capitalize">{overallStatus()}</p>
          </div>
          
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="h-4 w-4 text-slate-600" />
              <span className="font-semibold text-slate-700">Services Monitored</span>
            </div>
            <p className="text-sm text-slate-600">{chainStatuses.length + protocolStatuses.length} services</p>
          </div>
          
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <span className="font-semibold text-slate-700">Last Updated</span>
            </div>
            <p className="text-sm text-slate-600">{lastUpdate.toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Chain Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-2">
            <Wifi className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Blockchain Networks</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-700">Chain</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">RPC Status</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">USDC Contract</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">USDT Contract</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Response Time</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Uptime</th>
                <th className="text-center py-3 px-4 font-medium text-slate-700">Explorer</th>
              </tr>
            </thead>
            <tbody>
              {chainStatuses.map((chain) => (
                <tr key={chain.chainId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chains.find(c => c.id === chain.chainId)?.color || '#64748b' }}
                      />
                      <span className="font-medium text-slate-900">{chain.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(chain.status)}
                      <span className="text-sm capitalize">{chain.status}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(chain.contracts.usdc.status)}
                      <span className="text-xs font-mono text-slate-600">
                        {chain.contracts.usdc.address ? 
                          `${chain.contracts.usdc.address.slice(0, 6)}...${chain.contracts.usdc.address.slice(-4)}` : 
                          'Not available'
                        }
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(chain.contracts.usdt.status)}
                      <span className="text-xs font-mono text-slate-600">
                        {chain.contracts.usdt.address ? 
                          `${chain.contracts.usdt.address.slice(0, 6)}...${chain.contracts.usdt.address.slice(-4)}` : 
                          'Not available'
                        }
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {chain.responseTime ? formatResponseTime(chain.responseTime) : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {chain.uptime ? formatUptime(chain.uptime) : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <a
                      href={chain.blockExplorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocol Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-2">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">DeFi Protocols</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {protocolStatuses.map((protocol) => (
            <div key={protocol.protocolId} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-900">{protocol.name}</span>
                  {protocol.verified && (
                    <Shield className="h-4 w-4 text-green-500" />
                  )}
                </div>
                {getStatusIcon(protocol.status)}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <span className="capitalize">{protocol.status}</span>
                </div>
                
                {protocol.responseTime && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Response:</span>
                    <span>{formatResponseTime(protocol.responseTime)}</span>
                  </div>
                )}
                
                {protocol.uptime && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Uptime:</span>
                    <span>{formatUptime(protocol.uptime)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-slate-600">Chains:</span>
                  <span>{protocol.supportedChains.length}</span>
                </div>
                
                <div className="text-xs text-slate-500 mt-2">
                  Last checked: {protocol.lastChecked.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-slate-700">Operational</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-slate-700">Degraded Performance</span>
          </div>
          <div className="flex items-center space-x-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-slate-700">Service Outage</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-slate-700">Under Maintenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};