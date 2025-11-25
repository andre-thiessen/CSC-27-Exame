# Exemplo de Arquivo .env

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
BASE_MAINNET_RPC_URL=
DEPLOYER_PRIVATE_KEY=
NEXT_PUBLIC_BASE_RPC_URL=
NEXT_PUBLIC_RELAYER_PRIVATE_KEY=
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_ENTRY_POINT_ADDRESS=
NEXT_PUBLIC_PIMLICO_BUNDLER_URL=
NEXT_PUBLIC_PIMLICO_PAYMASTER_URL=
```

## Como obter os valores:

### BASE_MAINNET_RPC_URL / NEXT_PUBLIC_BASE_RPC_URL

**Opção 1: RPC Público (limitado, não recomendado para produção)**

```
BASE_MAINNET_RPC_URL=https://mainnet.base.org
```

**Opção 2: Alchemy (recomendado)**

1. Acesse https://www.alchemy.com/
2. Crie uma conta gratuita
3. Crie um novo App selecionando "Base" como rede
4. Copie a HTTP URL e use como `BASE_MAINNET_RPC_URL`

### DEPLOYER_PRIVATE_KEY / NEXT_PUBLIC_RELAYER_PRIVATE_KEY

Esta é a chave privada da conta que fará o deploy dos contratos.

⚠️ **IMPORTANTE:**

- Esta conta deve ter ETH na Base Mainnet para pagar o gas
- Nunca compartilhe sua chave privada
- Nunca commite o arquivo `.env` no git
- Use uma conta separada para testes/deploy, não sua conta principal

**Formato:** A chave privada deve começar com `0x` seguido de 64 caracteres hexadecimais.
