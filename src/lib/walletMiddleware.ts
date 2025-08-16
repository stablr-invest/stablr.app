// Wallet middleware to handle different wallet providers and connection logic
import * as ethers from 'ethers';

export interface WalletProvider {
  name: string;
  isAvailable: () => boolean;
  connect: () => Promise<{
    address: string;
    chainId: number;
    provider: ethers.BrowserProvider;
  }>;
  disconnect: () => void;
  onAccountsChanged: (callback: (accounts: string[]) => void) => void;
  onChainChanged: (callback: (chainId: string) => void) => void;
  removeListeners: () => void;
}

class MetaMaskProvider implements WalletProvider {
  name = 'MetaMask';

  isAvailable(): boolean {
    return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
  }

  async connect() {
    if (!this.isAvailable()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension.');
    }

    try {
      // Use 'any' network to avoid NETWORK_ERROR when user switches chains
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      
      // Always request fresh account access (this will show MetaMask popup)
      await provider.send('eth_requestAccounts', []);
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      return {
        address,
        chainId: network.chainId,
        provider
      };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('Connection request was rejected. Please approve the connection in MetaMask.');
      } else if (error.code === -32002) {
        throw new Error('Connection request is already pending. Please check MetaMask and approve the request.');
      } else if (error.code === -32603) {
        throw new Error('MetaMask internal error. Please try refreshing the page.');
      } else {
        const errorMessage = error.message || 'Unknown error';
        throw new Error(`Failed to connect to MetaMask: ${errorMessage}. Please try the following steps: 1) Ensure MetaMask is unlocked and you're logged in, 2) Check for any pending connection requests in the MetaMask extension, 3) Try refreshing this page, 4) If the issue persists, try restarting your browser or disabling/re-enabling the MetaMask extension.`);
      }
    }
  }

  disconnect(): void {
    // MetaMask doesn't have a programmatic disconnect
    // Users need to disconnect manually from the extension
  }

  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  onChainChanged(callback: (chainId: string) => void): void {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  removeListeners(): void {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  }
}

class GenericProvider implements WalletProvider {
  name = 'Web3 Wallet';

  isAvailable(): boolean {
    return typeof window.ethereum !== 'undefined' && !window.ethereum.isMetaMask;
  }

  async connect() {
    if (!this.isAvailable()) {
      throw new Error('No Web3 wallet detected. Please install a Web3 wallet extension.');
    }

    try {
      // Use 'any' network to avoid NETWORK_ERROR when user switches chains
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      await provider.send('eth_requestAccounts', []);
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      return {
        address,
        chainId: network.chainId,
        provider
      };
    } catch (error: any) {
      throw new Error(`Failed to connect to wallet: ${error.message || 'Unknown error'}`);
    }
  }

  disconnect(): void {
    // Generic disconnect
  }

  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  onChainChanged(callback: (chainId: string) => void): void {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  removeListeners(): void {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  }
}

export class WalletMiddleware {
  private providers: WalletProvider[] = [
    new MetaMaskProvider(),
    new GenericProvider()
  ];

  getAvailableProviders(): WalletProvider[] {
    return this.providers.filter(provider => provider.isAvailable());
  }

  getPrimaryProvider(): WalletProvider | null {
    const available = this.getAvailableProviders();
    return available.length > 0 ? available[0] : null;
  }

  async connectWallet(): Promise<{
    address: string;
    chainId: number;
    provider: ethers.providers.Web3Provider;
    walletName: string;
  }> {
    const primaryProvider = this.getPrimaryProvider();
    
    if (!primaryProvider) {
      throw new Error('No Web3 wallet detected. Please install MetaMask or another Web3 wallet extension.');
    }

    // Always request fresh connection - don't rely on cached state
    const result = await primaryProvider.connect();
    
    return {
      ...result,
      walletName: primaryProvider.name
    };
  }

  setupEventListeners(
    onAccountsChanged: (accounts: string[]) => void,
    onChainChanged: (chainId: string) => void
  ): () => void {
    const primaryProvider = this.getPrimaryProvider();
    
    if (primaryProvider) {
      primaryProvider.onAccountsChanged(onAccountsChanged);
      primaryProvider.onChainChanged(onChainChanged);
      
      return () => primaryProvider.removeListeners();
    }
    
    return () => {};
  }

  async checkExistingConnection(): Promise<{
    address: string;
    chainId: number;
    provider: ethers.providers.Web3Provider;
  } | null> {
    const primaryProvider = this.getPrimaryProvider();
    
    if (!primaryProvider) {
      return null;
    }

    try {
      // Use 'any' network to avoid NETWORK_ERROR when user switches chains
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        const network = await provider.getNetwork();
        return {
          address: accounts[0],
          chainId: network.chainId,
          provider
        };
      }
    } catch (error) {
      console.error('Error checking existing connection:', error);
    }
    
    return null;
  }
}

export const walletMiddleware = new WalletMiddleware();