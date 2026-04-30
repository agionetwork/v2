"use client";

import { useWalletContext } from "@/components/wallet-provider";

export function WalletDebug() {
  const { 
    isConnected, 
    address, 
    provider
  } = useWalletContext();

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Wallet Debug Info:</h3>
      <div className="space-y-1">
        <div>Wallet Context:</div>
        <div>• isConnected: {isConnected ? 'true' : 'false'}</div>
        <div>• address: {address || 'null'}</div>
        <div>• provider: {provider || 'null'}</div>
        
        <div className="mt-2">Status:</div>
        <div>• Solana wallet connection ready</div>
      </div>
    </div>
  );
}
