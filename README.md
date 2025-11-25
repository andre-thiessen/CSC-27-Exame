# Smart Wallet POC (Passkey + ERC-4337) - Deployment Guide

Proof of Concept de uma Smart Wallet baseada em Passkeys usando o padrão ERC-4337 e o precompile RIP-7212 da Base Mainnet.

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Deploy na Base Mainnet](#deploy-na-base-mainnet)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Tecnologias](#tecnologias)

## Pré-requisitos

Antes de começar, certifique-se de ter:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- **Conta EOA** (Externally Owned Account) com ETH na Base Mainnet para pagar o gas do deploy
- **RPC URL** da Base Mainnet (pode usar um RPC público ou criar uma conta em serviços como Alchemy, Infura ou QuickNode)

## Instalação

1. Clone o repositório (se aplicável) ou navegue até o diretório do projeto:

```bash
cd /caminho/para/o/projeto
```

2. Instale as dependências:

```bash
npm install
```

Isso instalará todas as dependências necessárias, incluindo:

- Hardhat e plugins
- TypeScript
- Ethers.js
- Dotenv

## Configuração

### 1. Criar arquivo `.env`

Crie um arquivo `.env` na raiz do projeto e adicione as variáveis necessárias.

### 2. Obter RPC URL da Base Mainnet

Você pode usar um dos seguintes métodos:

**Opção 1: RPC Público (limitado)**

```
BASE_MAINNET_RPC_URL=https://mainnet.base.org
```

**Opção 2: Serviços de RPC (recomendado para produção)**

- [Alchemy](https://www.alchemy.com/) - Crie uma conta e obtenha sua API key
- [Infura](https://www.infura.io/) - Crie uma conta e obtenha sua API key
- [QuickNode](https://www.quicknode.com/) - Crie uma conta e obtenha sua API key

Exemplo com Alchemy:

```
BASE_MAINNET_RPC_URL=https://base-mainnet.g.alchemy.com/v2/SUA_API_KEY
```

### 3. Obter ETH na Base Mainnet

Para fazer o deploy, você precisa de ETH na Base Mainnet para pagar o gas. Você pode:

1. **Bridge de ETH** da Ethereum Mainnet para Base usando a [Base Bridge oficial](https://bridge.base.org/)
2. **Comprar ETH diretamente** em exchanges que suportam Base Mainnet
3. **Usar um faucet** (se disponível para testes)

**Importante:** Certifique-se de que a conta correspondente à `DEPLOYER_PRIVATE_KEY` tenha ETH suficiente (recomendado: pelo menos 0.01 ETH).

## Deploy na Base Mainnet

### Comando de Deploy

Execute o seguinte comando para fazer o deploy dos contratos na Base Mainnet:

```bash
npm run deploy:base
```

Ou usando o Hardhat diretamente:

```bash
npx hardhat run --network baseMainnet scripts/deploy.ts
```

### O que o script faz?

O script de deploy (`scripts/deploy.ts`) executa a seguinte sequência:

1. **Deploy de `BasePasskeyWallet.sol`** (Implementação da Conta)

   - O construtor recebe o endereço do EntryPoint oficial: `0x5FF137D4b0FDCD49DcA30c7CF57E578a06dD0bc2`
   - Este contrato será usado como implementação base para os proxies

2. **Deploy de `BasePasskeyWalletFactory.sol`** (Factory)
   - O construtor recebe o endereço do EntryPoint
   - O Factory usa a implementação deployada no passo anterior para criar proxies via ERC1967Proxy

### Saída do Deploy

Após a execução bem-sucedida, você verá no console:

```
=======================================================
DEPLOY CONCLUÍDO COM SUCESSO!
=======================================================
EntryPoint Address: 0x5FF137D4b0FDCD49DcA30c7CF57E578a06dD0bc2
Wallet Implementation: 0x...
Factory Address: 0x...
=======================================================
INTEGRAÇÃO FRONTEND:
Factory Address (Use no Frontend para calcular endereços): 0x...
=======================================================
```

## Pós-Deploy

### ⚠️ Informação Importante

**O endereço do `BasePasskeyWalletFactory` é o mais importante!**

Este endereço deve ser usado no frontend para:

- Calcular o endereço counterfactual (pre-deploy) da carteira do usuário usando a função `getAddress()`
- Criar novas contas usando a função `createAccount()`

### Integração no Frontend

No seu código frontend (Next.js), você precisará:

1. **Importar o ABI do Factory** (gerado em `artifacts/contracts/BasePasskeyWalletFactory.sol/BasePasskeyWalletFactory.json`)

2. **Usar o endereço do Factory** para calcular endereços de carteira:

```typescript
import { BasePasskeyWalletFactory } from "./artifacts/contracts/BasePasskeyWalletFactory.sol/BasePasskeyWalletFactory.json";

const factoryAddress = "0x..."; // Endereço do Factory deployado
const factory = new ethers.Contract(
  factoryAddress,
  BasePasskeyWalletFactory.abi,
  provider
);

// Calcular endereço counterfactual
const walletAddress = await factory.getAddress(salt, pubKeyX, pubKeyY);
```

3. **Criar contas** quando necessário:

```typescript
const tx = await factory.createAccount(salt, pubKeyX, pubKeyY);
await tx.wait();
```

## Estrutura do Projeto

```
exame/
├── contracts/              # Contratos Solidity
│   ├── BasePasskeyWallet.sol
│   ├── BasePasskeyWalletFactory.sol
│   ├── IP256Verifier.sol
│   ├── IAccount.sol
│   └── UserOperation.sol
├── scripts/                # Scripts de deploy
│   └── deploy.ts
├── artifacts/              # Artifacts gerados pelo Hardhat (após compile)
├── cache/                 # Cache do Hardhat
├── app/                    # Frontend Next.js
├── components/             # Componentes React
├── lib/                    # Bibliotecas e utilitários
├── hardhat.config.ts      # Configuração do Hardhat
├── .env                    # Variáveis de ambiente (não commitar!)
└── package.json
```

## Tecnologias

### Frontend

- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Viem** - Biblioteca para interação com blockchain

### Smart Contracts

- **Solidity 0.8.20**
- **ERC-4337** - Account Abstraction
- **RIP-7212** - Precompile P-256 da Base Mainnet
- **ERC-1967** - Proxy Pattern

### Deploy

- **Hardhat** - Framework de desenvolvimento
- **Ethers.js** - Biblioteca para interação com contratos
- **TypeScript** - Tipagem estática

## Troubleshooting

### Erro: "Conta deployer não possui ETH"

- Certifique-se de que a conta correspondente à `DEPLOYER_PRIVATE_KEY` tenha ETH na Base Mainnet
- Verifique o saldo em [BaseScan](https://basescan.org/)

### Erro: "Invalid RPC URL"

- Verifique se o `BASE_MAINNET_RPC_URL` está correto
- Teste a URL do RPC em um explorador ou ferramenta de teste

### Erro: "Nonce too high"

- Aguarde alguns segundos e tente novamente
- Verifique se há transações pendentes na sua conta

### Erro de compilação

- Execute `npx hardhat clean` e depois `npx hardhat compile`
- Verifique se todas as dependências estão instaladas: `npm install`

## Segurança

⚠️ **IMPORTANTE:**

- **NUNCA** compartilhe sua chave privada
- **NUNCA** commite o arquivo `.env` no git
- Use variáveis de ambiente em produção
- Revise os contratos antes de fazer deploy em mainnet
- Considere usar uma carteira hardware para o deploy em produção

## Links Úteis

- [Base Mainnet Explorer](https://basescan.org/)
- [Base Bridge](https://bridge.base.org/)
- [ERC-4337 Documentation](https://docs.erc4337.io/)
- [Hardhat Documentation](https://hardhat.org/docs)

## Licença

Este projeto é uma POC (Proof of Concept) para fins educacionais.
