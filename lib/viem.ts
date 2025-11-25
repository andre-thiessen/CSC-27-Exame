import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const DEFAULT_BASE_RPC = "https://mainnet.base.org";

const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL &&
  process.env.NEXT_PUBLIC_BASE_RPC_URL !== ""
    ? process.env.NEXT_PUBLIC_BASE_RPC_URL
    : DEFAULT_BASE_RPC;

// Cliente público para Base Mainnet
export const publicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

const relayerPrivateKey = process.env.NEXT_PUBLIC_RELAYER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

export const relayerAccount = relayerPrivateKey
  ? privateKeyToAccount(relayerPrivateKey)
  : undefined;

export const relayerClient = relayerAccount
  ? createWalletClient({
      account: relayerAccount,
      chain: base,
      transport: http(baseRpcUrl),
    })
  : undefined;

// Endereço do token USDC na Base Mainnet
export const USDC_TOKEN_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// ABI mínimo para balanceOf do ERC20
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;
