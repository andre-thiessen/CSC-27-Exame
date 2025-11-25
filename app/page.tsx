"use client";

import ActionButtons from "@/components/ActionButtons";
import Toast from "@/components/Toast";
import WalletCard from "@/components/WalletCard";
import {
  arrayBufferToBase64url,
  base64urlToArrayBuffer,
  registerPasskeyWithPublicKey,
} from "@/lib/passkey";
import {
  ERC20_ABI,
  publicClient,
  relayerClient,
  USDC_TOKEN_ADDRESS,
} from "@/lib/viem";
import { startAuthentication } from "@simplewebauthn/browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  hexToBytes,
  keccak256,
  parseUnits,
  stringToBytes,
  toHex,
} from "viem";

// Chave para localStorage
const PASSKEY_CREDENTIAL_ID_KEY = "passkeyCredentialId";
const WALLET_ADDRESS_STORAGE_KEY = "smartWalletAddress";
const PASSKEY_PUBLIC_KEY_STORAGE_KEY = "passkeyPublicKey";
const PASSKEY_SALT_STORAGE_KEY = "passkeySalt";
const PASSKEY_KEY_HASH_STORAGE_KEY = "passkeyKeyHash";

const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "") as `0x${string}`;
const ENTRY_POINT_ADDRESS = (process.env.NEXT_PUBLIC_ENTRY_POINT_ADDRESS ||
  "") as `0x${string}`;

const PASSKEY_WALLET_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "salt", type: "uint256" },
      { internalType: "string", name: "keyId", type: "string" },
      { internalType: "uint256", name: "pubKeyX", type: "uint256" },
      { internalType: "uint256", name: "pubKeyY", type: "uint256" },
    ],
    name: "createAccount",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "salt", type: "uint256" },
      { internalType: "string", name: "keyId", type: "string" },
      { internalType: "uint256", name: "pubKeyX", type: "uint256" },
      { internalType: "uint256", name: "pubKeyY", type: "uint256" },
    ],
    name: "getAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const ENTRY_POINT_ABI = [
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getUserOpHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "handleOps",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
  },
] as const;

const WALLET_EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// Valores padrão para gas limits
const DEFAULT_CALL_GAS = 200000n;
const DEFAULT_VERIFICATION_GAS = 500000n;
const DEFAULT_PRE_VERIFICATION_GAS = 50000n;
const EMPTY_BYTES = "0x" as `0x${string}`;
const BUNDLER_URL = process.env.NEXT_PUBLIC_PIMLICO_BUNDLER_URL as
  | string
  | undefined;
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PIMLICO_PAYMASTER_URL as
  | string
  | undefined;

type UserOperationStruct = {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
};

type DeployStatus = "idle" | "passkey" | "calculating" | "relaying" | "waiting";
type SendStatus =
  | "idle"
  | "building"
  | "estimating"
  | "passkey"
  | "bundling"
  | "waiting";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingDeployment, setIsLoadingDeployment] = useState(false);
  const [passkeyCredentialId, setPasskeyCredentialId] = useState<string | null>(
    null
  );
  const [isLoadingPasskeyRegistration, setIsLoadingPasskeyRegistration] =
    useState(false);
  const [isLoadingPasskeySignature, setIsLoadingPasskeySignature] =
    useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const deployStatusMessage = useMemo(() => {
    switch (deployStatus) {
      case "passkey":
        return "Criando Passkey e coletando chave pública...";
      case "calculating":
        return "Calculando endereço determinístico da carteira...";
      case "relaying":
        return "Enviando transação via Relayer...";
      case "waiting":
        return "Aguardando confirmação on-chain...";
      default:
        return "";
    }
  }, [deployStatus]);

  const sendStatusMessage = useMemo(() => {
    switch (sendStatus) {
      case "building":
        return "Montando UserOperation...";
      case "estimating":
        return "Estimando gás via Bundler...";
      case "passkey":
        return "Solicitando assinatura Passkey...";
      case "bundling":
        return "Enviando UserOperation ao Bundler...";
      case "waiting":
        return "Aguardando confirmação on-chain...";
      default:
        return "";
    }
  }, [sendStatus]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PASSKEY_CREDENTIAL_ID_KEY);
      if (stored) {
        setPasskeyCredentialId(stored);
      }
      const storedWallet = localStorage.getItem(WALLET_ADDRESS_STORAGE_KEY);
      if (storedWallet) {
        setWalletAddress(storedWallet);
      }
    }
  }, []);

  // Função para ler o saldo de USDC
  const readBalance = useCallback(async (address: string) => {
    setIsLoadingBalance(true);
    try {
      const balance = (await publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;

      // USDC tem 6 decimais
      const formattedBalance = formatUnits(balance, 6);
      setBalance(parseFloat(formattedBalance).toFixed(2));
    } catch (error) {
      console.error("Erro ao ler saldo:", error);
      setBalance("0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  // Função para verificar se o endereço é um contrato deployado
  const checkDeployment = useCallback(async (address: string) => {
    setIsLoadingDeployment(true);
    try {
      const code = await publicClient.getBytecode({
        address: address as `0x${string}`,
      });

      const isContract = !!(code && code !== "0x");
      setIsDeployed(isContract);
    } catch (error) {
      console.error("Erro ao verificar deploy:", error);
      setIsDeployed(false);
    } finally {
      setIsLoadingDeployment(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      readBalance(walletAddress);
      checkDeployment(walletAddress);
    }
  }, [walletAddress, readBalance, checkDeployment]);

  const handleDeploy = async () => {
    if (!FACTORY_ADDRESS) {
      setSuccessMessage("Configure NEXT_PUBLIC_FACTORY_ADDRESS no .env");
      setShowSuccessToast(true);
      return;
    }

    if (!relayerClient || !relayerClient.account) {
      setSuccessMessage("Relayer não configurado. Verifique a private key.");
      setShowSuccessToast(true);
      return;
    }

    setIsLoadingPasskeyRegistration(true);
    setDeployStatus("passkey");

    try {
      const { credentialId, pubKeyX, pubKeyY } =
        await registerPasskeyWithPublicKey();

      setPasskeyCredentialId(credentialId);
      if (typeof window !== "undefined") {
        localStorage.setItem(PASSKEY_CREDENTIAL_ID_KEY, credentialId);
      }

      const saltHex = keccak256(stringToBytes(credentialId));
      const salt = BigInt(saltHex);

      const keyIdBytes = new TextEncoder().encode(credentialId);
      const keyHash = keccak256(toHex(keyIdBytes) as `0x${string}`);

      if (typeof window !== "undefined") {
        localStorage.setItem(PASSKEY_KEY_HASH_STORAGE_KEY, keyHash);
      }

      setDeployStatus("calculating");
      const predictedAddress = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: PASSKEY_WALLET_FACTORY_ABI,
        functionName: "getAddress",
        args: [salt, credentialId, pubKeyX, pubKeyY],
      })) as string;

      setWalletAddress(predictedAddress);

      if (typeof window !== "undefined") {
        localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, predictedAddress);
        localStorage.setItem(
          PASSKEY_PUBLIC_KEY_STORAGE_KEY,
          JSON.stringify({
            x: pubKeyX.toString(),
            y: pubKeyY.toString(),
          })
        );
        localStorage.setItem(PASSKEY_SALT_STORAGE_KEY, salt.toString());
      }

      setDeployStatus("relaying");
      const txHash = await relayerClient.writeContract({
        account: relayerClient.account,
        address: FACTORY_ADDRESS,
        abi: PASSKEY_WALLET_FACTORY_ABI,
        functionName: "createAccount",
        args: [salt, credentialId, pubKeyX, pubKeyY],
      });

      setDeployStatus("waiting");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setIsDeployed(true);
      await readBalance(predictedAddress);
      await checkDeployment(predictedAddress);

      console.log("Smart Wallet criada e ativada!", txHash);

      setSuccessMessage("Smart Wallet criada e ativada!");
      setShowSuccessToast(true);
    } catch (error: any) {
      console.error("Erro ao criar Smart Wallet:", error);
      setSuccessMessage(
        error?.message || "Erro ao criar Smart Wallet. Tente novamente."
      );
      setShowSuccessToast(true);
    } finally {
      setIsLoadingPasskeyRegistration(false);
      setDeployStatus("idle");
    }
  };

  const handleSend = async (to: string, amount: string) => {
    if (!walletAddress || !passkeyCredentialId) {
      setSuccessMessage("Wallet ou Passkey não encontrados.");
      setShowSuccessToast(true);
      return;
    }

    if (!ENTRY_POINT_ADDRESS) {
      setSuccessMessage("Configure NEXT_PUBLIC_ENTRY_POINT_ADDRESS.");
      setShowSuccessToast(true);
      return;
    }

    if (!relayerClient || !relayerClient.account) {
      setSuccessMessage("Relayer não configurado. Verifique a private key.");
      setShowSuccessToast(true);
      return;
    }

    setIsLoadingPasskeySignature(true);
    setSendStatus("building");
    setSuccessMessage("");

    try {
      const parsedAmount = parseUnits(amount, 6);

      const usdcCalldata = encodeFunctionData({
        abi: [
          {
            name: "transfer",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ type: "bool" }],
          },
        ] as const,
        functionName: "transfer",
        args: [to as `0x${string}`, parsedAmount],
      });

      const walletCallData = encodeFunctionData({
        abi: WALLET_EXECUTE_ABI,
        functionName: "execute",
        args: [USDC_TOKEN_ADDRESS, 0n, usdcCalldata],
      }) as `0x${string}`;

      const nonce = (await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: ENTRY_POINT_ABI,
        functionName: "getNonce",
        args: [walletAddress as `0x${string}`, 0n],
      })) as bigint;

      const feeData = await publicClient.estimateFeesPerGas();

      console.log("feeData:", feeData);

      const defaultMaxFeePerGas = feeData.maxFeePerGas || 1000000000n; // 1 gwei como fallback
      const defaultMaxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas || 100000000n; // 0.1 gwei como fallback

      const partialUserOp: UserOperationStruct = {
        sender: walletAddress as `0x${string}`,
        nonce,
        initCode: EMPTY_BYTES,
        callData: walletCallData,
        callGasLimit: DEFAULT_CALL_GAS,
        verificationGasLimit: DEFAULT_VERIFICATION_GAS,
        preVerificationGas: DEFAULT_PRE_VERIFICATION_GAS,
        maxFeePerGas: defaultMaxFeePerGas,
        maxPriorityFeePerGas: defaultMaxPriorityFeePerGas,
        paymasterAndData: EMPTY_BYTES,
        signature: EMPTY_BYTES,
      };
      if (!BUNDLER_URL) {
        throw new Error("Configure NEXT_PUBLIC_PIMLICO_BUNDLER_URL");
      }
      if (!PAYMASTER_URL) {
        throw new Error("Configure NEXT_PUBLIC_PIMLICO_PAYMASTER_URL");
      }

      setSendStatus("estimating");
      let userOpWithGas: UserOperationStruct = partialUserOp;

      try {
        const gasEstimates = await sendBundlerRequest(
          "eth_estimateUserOperationGas",
          [serializeUserOp(partialUserOp), ENTRY_POINT_ADDRESS]
        );

        const estimatedCallGas = hexToBigInt(gasEstimates.callGasLimit);
        const estimatedVerificationGas = hexToBigInt(
          gasEstimates.verificationGasLimit
        );
        const estimatedPreVerificationGas = hexToBigInt(
          gasEstimates.preVerificationGas
        );
        const estimatedMaxFeePerGas = hexToBigInt(gasEstimates.maxFeePerGas);
        const estimatedMaxPriorityFeePerGas = hexToBigInt(
          gasEstimates.maxPriorityFeePerGas
        );

        if (
          estimatedCallGas > 0n &&
          estimatedVerificationGas > 0n &&
          estimatedPreVerificationGas > 0n
        ) {
          userOpWithGas = {
            ...partialUserOp,
            callGasLimit: estimatedCallGas,
            verificationGasLimit: estimatedVerificationGas,
            preVerificationGas: estimatedPreVerificationGas,
            maxFeePerGas: estimatedMaxFeePerGas || defaultMaxFeePerGas,
            maxPriorityFeePerGas:
              estimatedMaxPriorityFeePerGas || defaultMaxPriorityFeePerGas,
          };
          console.log("Gás estimado com sucesso pelo bundler");
        } else {
          console.warn(
            "Bundler retornou valores de gás inválidos, usando padrão"
          );
        }
      } catch (error) {
        console.warn(
          "Falha ao estimar gás via Bundler (normal se assinatura estiver vazia), usando valores padrão:",
          error
        );
      }

      let sponsoredUserOp: UserOperationStruct = userOpWithGas;
      try {
        const paymasterResult = await sendPaymasterRequest(
          "pm_sponsorUserOperation",
          [serializeUserOp(userOpWithGas), ENTRY_POINT_ADDRESS]
        );

        const sponsoredCallGas = hexToBigInt(paymasterResult.callGasLimit);
        const sponsoredVerificationGas = hexToBigInt(
          paymasterResult.verificationGasLimit
        );
        const sponsoredPreVerificationGas = hexToBigInt(
          paymasterResult.preVerificationGas
        );
        const sponsoredMaxFeePerGas = hexToBigInt(paymasterResult.maxFeePerGas);
        const sponsoredMaxPriorityFeePerGas = hexToBigInt(
          paymasterResult.maxPriorityFeePerGas
        );

        if (
          sponsoredCallGas > 0n &&
          sponsoredVerificationGas > 0n &&
          sponsoredPreVerificationGas > 0n &&
          sponsoredMaxFeePerGas > 0n &&
          sponsoredMaxPriorityFeePerGas > 0n
        ) {
          sponsoredUserOp = {
            ...userOpWithGas,
            paymasterAndData: paymasterResult.paymasterAndData as `0x${string}`,
            callGasLimit: sponsoredCallGas,
            verificationGasLimit: sponsoredVerificationGas,
            preVerificationGas: sponsoredPreVerificationGas,
            maxFeePerGas: sponsoredMaxFeePerGas,
            maxPriorityFeePerGas: sponsoredMaxPriorityFeePerGas,
          };
          console.log("Paymaster patrocinou a operação com sucesso");
        } else {
          console.warn(
            "Paymaster retornou valores inválidos, usando valores sem patrocínio"
          );
          if (
            paymasterResult.paymasterAndData &&
            paymasterResult.paymasterAndData !== "0x"
          ) {
            sponsoredUserOp = {
              ...userOpWithGas,
              paymasterAndData:
                paymasterResult.paymasterAndData as `0x${string}`,
            };
          }
        }
      } catch (error) {
        console.warn(
          "Falha ao obter patrocínio do Paymaster (pode ser normal se assinatura estiver vazia), continuando sem patrocínio:",
          error
        );
      }

      const userOpForHash: UserOperationStruct = {
        ...sponsoredUserOp,
        signature: EMPTY_BYTES,
      };

      const userOpHash = (await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: ENTRY_POINT_ABI,
        functionName: "getUserOpHash",
        args: [userOpForHash],
      })) as `0x${string}`;

      setSendStatus("passkey");

      const challengeBytes = hexToBytes(userOpHash);
      if (challengeBytes.length !== 32) {
        throw new Error(
          `Challenge deve ter 32 bytes, mas tem ${challengeBytes.length}`
        );
      }
      const challengeBase64 = arrayBufferToBase64url(
        challengeBytes.buffer as ArrayBuffer
      );

      const assertion = await startAuthentication({
        challenge: challengeBase64,
        allowCredentials: [
          {
            id: passkeyCredentialId,
            type: "public-key",
          },
        ],
        userVerification: "required",
      });

      const signatureBuffer = base64urlToArrayBuffer(
        assertion.response.signature
      );
      const { r, s } = derSignatureToRS(signatureBuffer);
      const authenticatorDataBuffer = base64urlToArrayBuffer(
        assertion.response.authenticatorData
      );
      const clientDataJSONBuffer = base64urlToArrayBuffer(
        assertion.response.clientDataJSON
      );

      const clientDataJSONText = new TextDecoder().decode(clientDataJSONBuffer);
      const challengeMatch = clientDataJSONText.match(/"challenge":"([^"]+)"/);

      if (!challengeMatch) {
        throw new Error(
          "Não foi possível encontrar o challenge no clientDataJSON"
        );
      }

      const fullMatch = challengeMatch[0];
      const challengeValue = challengeMatch[1];

      const challengeLabel = '"challenge":"';
      const challengeLabelIndex = clientDataJSONText.indexOf(challengeLabel);
      if (challengeLabelIndex === -1) {
        throw new Error("Não foi possível encontrar o label 'challenge'");
      }

      const challengeStart = challengeLabelIndex + challengeLabel.length;
      const challengeEnd = challengeStart + challengeValue.length;

      const clientDataJSONPre = clientDataJSONText.substring(0, challengeStart);
      const clientDataJSONPost = clientDataJSONText.substring(challengeEnd);

      const keyIdBytes = new TextEncoder().encode(passkeyCredentialId);
      const keyHash = keccak256(toHex(keyIdBytes) as `0x${string}`);

      if (typeof window !== "undefined") {
        const storedKeyHash = localStorage.getItem(
          PASSKEY_KEY_HASH_STORAGE_KEY
        );
        if (storedKeyHash) {
          if (storedKeyHash.toLowerCase() !== keyHash.toLowerCase()) {
            console.error("ERRO: KeyHash não corresponde ao usado no deploy!");
          } else {
            console.log("✓ KeyHash corresponde ao usado no deploy");
          }
        } else {
          console.warn(
            "KeyHash não encontrado no localStorage - não é possível verificar"
          );
        }
      }

      const userOpHashBytes = hexToBytes(userOpHash);
      const userOpHashBase64 = arrayBufferToBase64url(
        userOpHashBytes.buffer as ArrayBuffer
      );
      const reconstructedClientDataJSON =
        clientDataJSONPre + userOpHashBase64 + clientDataJSONPost;

      const reconstructedClientDataBytes = new TextEncoder().encode(
        reconstructedClientDataJSON
      );
      const clientDataHashBuffer = await crypto.subtle.digest(
        "SHA-256",
        reconstructedClientDataBytes
      );
      const clientDataHash = new Uint8Array(clientDataHashBuffer);

      const authenticatorDataBytes = new Uint8Array(authenticatorDataBuffer);
      const combinedForHash = new Uint8Array(
        authenticatorDataBytes.length + clientDataHash.length
      );
      combinedForHash.set(authenticatorDataBytes, 0);
      combinedForHash.set(clientDataHash, authenticatorDataBytes.length);

      const signedHashBuffer = await crypto.subtle.digest(
        "SHA-256",
        combinedForHash
      );
      const signedHashBytes = new Uint8Array(signedHashBuffer);
      const signedHashHex = `0x${Array.from(signedHashBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      // Converter r e s para bigint
      const rBigInt = BigInt(
        `0x${Array.from(r)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`
      );
      const sBigInt = BigInt(
        `0x${Array.from(s)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`
      );

      // Codificar a assinatura usando ABI encoding
      const signatureHex = encodePasskeySignature({
        keyHash,
        sigx: rBigInt,
        sigy: sBigInt,
        authenticatorData: authenticatorDataBuffer,
        clientDataJSONPre,
        clientDataJSONPost,
      });

      const finalUserOp: UserOperationStruct = {
        ...sponsoredUserOp,
        signature: signatureHex,
        // Garantir valores mínimos se algum estiver zerado
        callGasLimit: sponsoredUserOp.callGasLimit || DEFAULT_CALL_GAS,
        verificationGasLimit:
          sponsoredUserOp.verificationGasLimit || DEFAULT_VERIFICATION_GAS,
        preVerificationGas:
          sponsoredUserOp.preVerificationGas || DEFAULT_PRE_VERIFICATION_GAS,
        maxFeePerGas: sponsoredUserOp.maxFeePerGas || defaultMaxFeePerGas,
        maxPriorityFeePerGas:
          sponsoredUserOp.maxPriorityFeePerGas || defaultMaxPriorityFeePerGas,
      };

      // Validar que todos os valores de gás estão corretos antes de enviar
      if (
        finalUserOp.callGasLimit === 0n ||
        finalUserOp.verificationGasLimit === 0n ||
        finalUserOp.preVerificationGas === 0n ||
        finalUserOp.maxFeePerGas === 0n ||
        finalUserOp.maxPriorityFeePerGas === 0n
      ) {
        throw new Error(
          `Valores de gás inválidos na UserOperation final: callGasLimit=${finalUserOp.callGasLimit}, verificationGasLimit=${finalUserOp.verificationGasLimit}, preVerificationGas=${finalUserOp.preVerificationGas}, maxFeePerGas=${finalUserOp.maxFeePerGas}, maxPriorityFeePerGas=${finalUserOp.maxPriorityFeePerGas}`
        );
      }

      const finalUserOpForHash: UserOperationStruct = {
        ...finalUserOp,
        signature: EMPTY_BYTES,
      };
      const finalUserOpHash = (await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: ENTRY_POINT_ABI,
        functionName: "getUserOpHash",
        args: [finalUserOpForHash],
      })) as `0x${string}`;

      if (finalUserOpHash !== userOpHash) {
        console.error(
          "ERRO: UserOpHash mudou! Original:",
          userOpHash,
          "Novo:",
          finalUserOpHash
        );
        throw new Error(
          "UserOpHash não corresponde - valores da UserOp mudaram"
        );
      }

      setSendStatus("bundling");

      const userOpResponse = (await sendBundlerRequest(
        "eth_sendUserOperation",
        [serializeUserOp(finalUserOp), ENTRY_POINT_ADDRESS]
      )) as `0x${string}`;

      setSendStatus("waiting");
      await waitForUserOperationReceipt(userOpResponse);
      await readBalance(walletAddress);

      const formattedTo = `${to.slice(0, 6)}...${to.slice(-4)}`;
      setSuccessMessage(
        `Transferência concluída! ${amount} USDC enviados para ${formattedTo}`
      );
      setShowSuccessToast(true);
    } catch (error: any) {
      console.error("Erro ao enviar UserOperation:", error);
      setSuccessMessage(error?.message || "Erro ao enviar transação.");
      setShowSuccessToast(true);
    } finally {
      setIsLoadingPasskeySignature(false);
      setSendStatus("idle");
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Exame CSC-27
          </h1>
          <p className="text-muted-foreground">
            Carteira Inteligente baseada em Passkeys (ERC-4337)
          </p>
        </div>

        {/* Estado 1: Não Inicializada - Mostrar apenas botão de criar */}
        {!walletAddress && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-8 shadow-lg text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Bem-vindo à Smart Wallet
              </h2>
              <p className="text-muted-foreground mb-6">
                Crie sua carteira inteligente baseada em Passkeys para começar a
                usar a rede Base.
              </p>
              <ActionButtons
                isDeployed={false}
                hasWallet={false}
                onDeploy={handleDeploy}
                onSend={handleSend}
                hasPasskey={!!passkeyCredentialId}
              />
            </div>
          </div>
        )}

        {/* Estado 2: Inicializada - Mostrar Card da Carteira */}
        {walletAddress && (
          <>
            <WalletCard
              address={walletAddress}
              isDeployed={isDeployed}
              balance={balance}
              isLoadingBalance={isLoadingBalance}
              isLoadingDeployment={isLoadingDeployment}
              hasPasskey={!!passkeyCredentialId}
            />

            <ActionButtons
              isDeployed={isDeployed}
              hasWallet={true}
              hasPasskey={!!passkeyCredentialId}
              isLoadingPasskeyRegistration={isLoadingPasskeyRegistration}
              isLoadingPasskeySignature={isLoadingPasskeySignature}
              onDeploy={handleDeploy}
              onSend={handleSend}
            />
          </>
        )}

        {/* Deploy Status Indicator */}
        {deployStatus !== "idle" && (
          <div className="w-full max-w-2xl mx-auto mt-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm text-foreground">
                  {deployStatusMessage}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Send Status Indicator */}
        {sendStatus !== "idle" && (
          <div className="w-full max-w-2xl mx-auto mt-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm text-foreground">
                  {sendStatusMessage}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Toast */}
      <Toast
        message={successMessage}
        isVisible={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        duration={5000}
      />
    </main>
  );
}

function derSignatureToRS(signature: ArrayBuffer): {
  r: Uint8Array;
  s: Uint8Array;
} {
  const bytes = new Uint8Array(signature);
  if (bytes[0] !== 0x30) {
    throw new Error("Assinatura DER inválida");
  }

  let offset = 2;
  const rComponent = readInteger(bytes, offset);
  offset = rComponent.nextOffset;
  const sComponent = readInteger(bytes, offset);

  return {
    r: pad32(rComponent.value),
    s: pad32(sComponent.value),
  };
}

function readInteger(bytes: Uint8Array, offset: number) {
  if (bytes[offset] !== 0x02) {
    throw new Error("Formato DER inesperado");
  }
  const length = bytes[offset + 1];
  const start = offset + 2;
  const end = start + length;
  return {
    value: bytes.slice(start, end),
    nextOffset: end,
  };
}

function pad32(value: Uint8Array): Uint8Array {
  const output = new Uint8Array(32);
  const slice = value.length > 32 ? value.slice(value.length - 32) : value;
  output.set(slice, 32 - slice.length);
  return output;
}

function encodePasskeySignature({
  keyHash,
  sigx,
  sigy,
  authenticatorData,
  clientDataJSONPre,
  clientDataJSONPost,
}: {
  keyHash: `0x${string}`;
  sigx: bigint;
  sigy: bigint;
  authenticatorData: ArrayBuffer;
  clientDataJSONPre: string;
  clientDataJSONPost: string;
}): `0x${string}` {
  const authDataBytes = new Uint8Array(authenticatorData);

  return encodeAbiParameters(
    [
      { name: "keyHash", type: "bytes32" },
      { name: "sigx", type: "uint256" },
      { name: "sigy", type: "uint256" },
      { name: "authenticatorData", type: "bytes" },
      { name: "clientDataJSONPre", type: "string" },
      { name: "clientDataJSONPost", type: "string" },
    ],
    [
      keyHash,
      sigx,
      sigy,
      toHex(authDataBytes) as `0x${string}`,
      clientDataJSONPre,
      clientDataJSONPost,
    ]
  ) as `0x${string}`;
}

function toHexValue(value: bigint | `0x${string}`): `0x${string}` {
  if (typeof value === "string") {
    return value;
  }
  const hex = value.toString(16);
  return `0x${hex}` as `0x${string}`;
}

function serializeUserOp(userOp: UserOperationStruct) {
  return {
    sender: userOp.sender,
    nonce: toHexValue(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: toHexValue(userOp.callGasLimit),
    verificationGasLimit: toHexValue(userOp.verificationGasLimit),
    preVerificationGas: toHexValue(userOp.preVerificationGas),
    maxFeePerGas: toHexValue(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHexValue(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

async function sendBundlerRequest(method: string, params: any[]) {
  if (!BUNDLER_URL) {
    throw new Error("Bundler URL não configurada");
  }
  const response = await fetch(BUNDLER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || "Erro ao chamar Bundler");
  }
  return json.result;
}

async function sendPaymasterRequest(method: string, params: any[]) {
  if (!PAYMASTER_URL) {
    throw new Error("Paymaster URL não configurada");
  }
  const response = await fetch(PAYMASTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || "Erro ao chamar Paymaster");
  }
  return json.result;
}

function hexToBigInt(value?: string | bigint): bigint {
  if (!value) return 0n;
  if (typeof value === "bigint") {
    return value;
  }
  return BigInt(value);
}

async function waitForUserOperationReceipt(userOpHash: `0x${string}`) {
  for (let i = 0; i < 30; i++) {
    const receipt = await sendBundlerRequest("eth_getUserOperationReceipt", [
      userOpHash,
    ]);
    if (receipt?.receipt?.transactionHash) {
      await publicClient.waitForTransactionReceipt({
        hash: receipt.receipt.transactionHash as `0x${string}`,
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Tempo esgotado aguardando confirmação da UserOperation.");
}
