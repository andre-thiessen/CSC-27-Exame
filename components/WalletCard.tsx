"use client";

import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

interface WalletCardProps {
  address: string;
  isDeployed: boolean;
  balance: string;
  isLoadingBalance?: boolean;
  isLoadingDeployment?: boolean;
  hasPasskey?: boolean;
}

export default function WalletCard({
  address,
  isDeployed,
  balance,
  isLoadingBalance = false,
  isLoadingDeployment = false,
  hasPasskey = false,
}: WalletCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">
            Smart Wallet
          </h2>
          <div className="flex items-center gap-2">
            {isLoadingDeployment ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verificando...
              </span>
            ) : isDeployed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Smart Wallet Ativa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                <XCircle className="w-3.5 h-3.5" />
                EOA/Não Deployado
              </span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Endereço da Carteira
          </label>
          <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3 border border-border">
            <code className="flex-1 text-sm font-mono text-foreground">
              {formatAddress(address)}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Copiar endereço"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Saldo USDC (Base)
          </label>
          <div className="bg-muted/50 rounded-md p-4 border border-border">
            {isLoadingBalance ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Carregando saldo...
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {balance}
                  </span>
                  <span className="text-sm text-muted-foreground">USDC</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
                </p>
              </>
            )}
          </div>
        </div>

        {/* Passkey Status */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Status Passkey
          </label>
          <div className="bg-muted/50 rounded-md p-3 border border-border">
            {hasPasskey ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Passkey Registrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                <XCircle className="w-3.5 h-3.5" />
                Passkey Não Registrado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
