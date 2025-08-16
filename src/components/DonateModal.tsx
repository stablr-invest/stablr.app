import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { X, HandCoins } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

type DonateModalProps = {
  onClose: () => void;
  treasuryAddress: string;
  chainSymbol?: string;
};

export const DonateModal: React.FC<DonateModalProps> = ({ onClose, treasuryAddress, chainSymbol = 'ETH' }) => {
  const { wallet, supportedChains, switchChain } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [isFetchingBalance, setIsFetchingBalance] = useState<boolean>(false);

  const selectedChain = useMemo(() => supportedChains.find((chain: { id: number }) => chain.id === selectedChainId) || null, [supportedChains, selectedChainId]);
  const selectedSymbol = selectedChain?.symbol || chainSymbol;

  // Do not early-return before hooks to avoid conditional hook warnings

  const setQuick = (v: string) => {
    setAmount(v);
  };

  useEffect(() => {
    setSelectedChainId(wallet.chainId ?? null);
  }, [wallet.chainId]);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (!selectedChainId || !wallet.address) return;
        setIsFetchingBalance(true);
        const chain = supportedChains.find((c: { id: number; rpc_url: string }) => c.id === selectedChainId);
        if (!chain) return;

        const rpcProvider = wallet.chainId === selectedChainId && wallet.provider
          ? wallet.provider
          : new ethers.providers.JsonRpcProvider({ url: chain.rpc_url, timeout: 15000 });

        const balanceWei = await rpcProvider.getBalance(wallet.address);
        setNativeBalance(ethers.utils.formatEther(balanceWei));
      } catch {
        setNativeBalance('0');
      } finally {
        setIsFetchingBalance(false);
      }
    };
    fetchBalance();
  }, [selectedChainId, wallet.address, wallet.chainId, supportedChains, wallet.provider]);

  // Auto-switch network when a different chain is selected
  useEffect(() => {
    const doSwitch = async () => {
      try {
        if (!selectedChainId) return;
        if (wallet.chainId !== selectedChainId) {
          await switchChain(selectedChainId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to switch network');
      }
    };
    doSwitch();
  }, [selectedChainId, wallet.chainId, switchChain]);

  const handleDonate = async () => {
    try {
      setIsSending(true);
      setError(null);
      if (!wallet.provider) throw new Error('Wallet not connected');
      if (!treasuryAddress || treasuryAddress.length !== 42) throw new Error('Invalid treasury address');
      const value = parseFloat(amount);
      if (!isFinite(value) || value <= 0) throw new Error('Enter a valid amount');

      // Ensure user is on the selected chain
      if (selectedChainId && wallet.chainId !== selectedChainId) {
        await switchChain(selectedChainId);
        return; // Wait for user to confirm; they can press Donate again
      }

      const signer = wallet.provider.getSigner();
      const txRequest: ethers.providers.TransactionRequest = {
        to: treasuryAddress,
        value: ethers.utils.parseEther(amount)
      };

      // Estimate gas and set conservative EIP-1559 fees
      const gasLimit = await signer.estimateGas(txRequest);
      const feeData = await wallet.provider.getFeeData();
      const base = feeData.lastBaseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
      const priority = ethers.utils.parseUnits('0.015', 'gwei');
      const maxFeePerGas = base.mul(2).add(priority);

      const tx = await signer.sendTransaction({
        ...txRequest,
        type: 2,
        gasLimit,
        maxPriorityFeePerGas: priority,
        maxFeePerGas
      });
      await tx.wait(1);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send donation');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <HandCoins className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Donate</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
            Stablr does not enforce withdrawal fees, we appreciate any support to keep us going.
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Connected: {wallet.chainId ? supportedChains.find((c: { id: number; name: string }) => c.id === wallet.chainId)?.name : '—'}</div>
            <div className="text-sm text-slate-600">Address: {wallet.address ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` : '—'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Network</label>
            <div className="flex items-center space-x-2">
              <select
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={selectedChainId ?? ''}
                onChange={(e) => setSelectedChainId(parseInt(e.target.value, 10))}
              >
                {supportedChains.map((c: { id: number; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Balance on {selectedChain?.name || '—'}: {isFetchingBalance ? '…' : `${nativeBalance} ${selectedSymbol}`}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount ({selectedSymbol})</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder={`0.00 ${selectedSymbol}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <div className="mt-2 flex items-center space-x-2">
              {['0.01','0.05','0.1','0.25'].map(v => (
                <button key={v} onClick={() => setQuick(v)} className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">{v}</button>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            onClick={handleDonate}
            disabled={isSending}
            className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-xl font-medium hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-60"
          >
            <HandCoins className="h-4 w-4" />
            <span>{isSending ? 'Sending…' : 'Donate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


