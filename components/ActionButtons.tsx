"use client";

import { Loader2, Send, Wallet, X } from "lucide-react";
import { useState } from "react";

interface ActionButtonsProps {
  isDeployed: boolean;
  hasWallet: boolean;
  hasPasskey: boolean;
  isLoadingPasskeyRegistration?: boolean;
  isLoadingPasskeySignature?: boolean;
  onDeploy: () => Promise<void>;
  onSend: (to: string, amount: string) => Promise<void>;
}

export default function ActionButtons({
  isDeployed,
  hasWallet,
  hasPasskey,
  isLoadingPasskeyRegistration = false,
  isLoadingPasskeySignature = false,
  onDeploy,
  onSend,
}: ActionButtonsProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});

  const validateAddress = (address: string): boolean => {
    return address.startsWith("0x") && address.length === 42;
  };

  const validateAmount = (amount: string): boolean => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      await onDeploy();
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSend = async () => {
    setErrors({});

    const newErrors: { to?: string; amount?: string } = {};

    if (!toAddress || !validateAddress(toAddress)) {
      newErrors.to =
        "Endereço inválido. Deve começar com 0x e ter 42 caracteres.";
    }

    if (!amount || !validateAmount(amount)) {
      newErrors.amount = "Valor inválido. Deve ser um número maior que zero.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSending(true);
    try {
      await onSend(toAddress, amount);
      setShowSendForm(false);
      setToAddress("");
      setAmount("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-6">
      <div className="flex flex-col sm:flex-row gap-3">
        {!hasWallet && (
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeploying || isLoadingPasskeyRegistration ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Criando Passkey...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span>Criar Smart Wallet</span>
              </>
            )}
          </button>
        )}

        {hasWallet && isDeployed && hasPasskey && (
          <button
            onClick={() => setShowSendForm(!showSendForm)}
            disabled={isLoadingPasskeySignature}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>Enviar USDC</span>
          </button>
        )}
      </div>

      {showSendForm && hasWallet && (
        <div className="mt-4 bg-card border border-border rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Enviar USDC
            </h3>
            <button
              onClick={() => {
                setShowSendForm(false);
                setToAddress("");
                setAmount("");
                setErrors({});
              }}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Endereço de Destino
              </label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {errors.to && (
                <p className="text-xs text-red-400 mt-1">{errors.to}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Valor (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {errors.amount && (
                <p className="text-xs text-red-400 mt-1">{errors.amount}</p>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || isLoadingPasskeySignature}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending || isLoadingPasskeySignature ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isLoadingPasskeySignature
                      ? "Aguardando Passkey..."
                      : "Enviando..."}
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirmar Envio</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
