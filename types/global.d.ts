// Definindo os tipos para o objeto window
interface Window {
  // Propriedades para detectar Phantom
  solana?: {
    connect: () => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    isPhantom?: boolean;
    isSolflare?: boolean;
    isConnected?: boolean;
    publicKey?: any;
  };
  
  // Propriedades para detectar Solflare
  solflare?: {
    connect: () => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    isSolflare?: boolean;
    isConnected?: boolean;
    publicKey?: any;
  };
  
  // Propriedades para detectar Backpack
  backpack?: {
    connect: () => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    isBackpack?: boolean;
    isXnft?: boolean;
    isConnected?: boolean;
    publicKey?: any;
    openExtensionPopup?: () => void;
  };
} 