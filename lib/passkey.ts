import { decode as cborDecode } from "cborg";

// Funções auxiliares para conversão de formatos
export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  console.log("base64url", base64url);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  const paddedBase64 = base64 + (padding ? "=".repeat(4 - padding) : "");
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  console.log("base64", base64);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Função para gerar um challenge aleatório
export function generateChallenge(): ArrayBuffer {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array.buffer;
}

// Função para criar opções de registro usando API nativa
export function createRegistrationOptions(): PublicKeyCredentialCreationOptions {
  const challenge = generateChallenge();
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  return {
    challenge,
    rp: {
      name: "Smart Wallet POC",
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: "user@smartwallet.local",
      displayName: "Smart Wallet User",
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "direct",
  };
}

// Função para criar opções de autenticação usando API nativa
export function createAuthenticationOptions(
  credentialId: string
): PublicKeyCredentialRequestOptions {
  const challenge = generateChallenge();
  const credentialIdBuffer = base64urlToArrayBuffer(credentialId);

  return {
    challenge,
    allowCredentials: [
      {
        id: credentialIdBuffer,
        type: "public-key",
        transports: ["internal", "hybrid"],
      },
    ],
    rpId: window.location.hostname,
    userVerification: "required",
    timeout: 60000,
  };
}

// Função para registrar Passkey usando API nativa
export type PasskeyRegistrationResult = {
  credentialId: string;
  pubKeyX: bigint;
  pubKeyY: bigint;
};

async function executeRegistration(): Promise<PublicKeyCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn não é suportado neste navegador");
  }

  const options = createRegistrationOptions();
  const credential = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential || !credential.id) {
    throw new Error("Falha ao criar credencial");
  }

  return credential;
}

export async function registerPasskey(): Promise<string> {
  const credential = await executeRegistration();
  return typeof credential.id === "string"
    ? credential.id
    : arrayBufferToBase64url(credential.id);
}

export async function registerPasskeyWithPublicKey(): Promise<PasskeyRegistrationResult> {
  const credential = await executeRegistration();

  const response = credential.response as AuthenticatorAttestationResponse & {
    getPublicKey?: () => ArrayBuffer | null;
  };

  let publicKeyBuffer = response.getPublicKey?.();

  if (!publicKeyBuffer || publicKeyBuffer.byteLength < 65) {
    publicKeyBuffer = extractPublicKeyFromAttestation(
      response.attestationObject
    );
  }

  if (!publicKeyBuffer) {
    throw new Error(
      "Não foi possível recuperar a chave pública. Atualize seu navegador ou tente novamente."
    );
  }

  const { x, y } = extractPublicKeyCoordinates(publicKeyBuffer);

  const credentialId =
    typeof credential.id === "string"
      ? credential.id
      : arrayBufferToBase64url(credential.id);

  return {
    credentialId,
    pubKeyX: x,
    pubKeyY: y,
  };
}

function extractPublicKeyCoordinates(buffer: ArrayBuffer): {
  x: bigint;
  y: bigint;
} {
  const bytes = new Uint8Array(buffer);
  const uncompressedMarkerIndex = bytes.lastIndexOf(0x04);

  if (uncompressedMarkerIndex === -1) {
    throw new Error("Formato de chave pública não suportado");
  }

  const xStart = uncompressedMarkerIndex + 1;
  const yStart = xStart + 32;

  if (bytes.length < yStart + 32) {
    throw new Error("Dados insuficientes para coordenadas P-256");
  }

  const xBytes = bytes.slice(xStart, xStart + 32);
  const yBytes = bytes.slice(yStart, yStart + 32);

  return {
    x: bytesToBigInt(xBytes),
    y: bytesToBigInt(yBytes),
  };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return BigInt(`0x${hex}`);
}

function extractPublicKeyFromAttestation(
  attestationObject: ArrayBuffer | null
): ArrayBuffer | null {
  if (!attestationObject) {
    return null;
  }

  try {
    const attestationStruct = cborDecode(new Uint8Array(attestationObject), {
      useMaps: true,
    }) as Map<string, any>;

    const authData = attestationStruct.get("authData") as
      | Uint8Array
      | undefined;
    if (!authData) {
      return null;
    }

    let offset = 37; // 32 bytes rpIdHash + 1 flag + 4 signCount
    const credentialDataFlag = (authData[32] & 0x40) !== 0;
    if (!credentialDataFlag) {
      return null;
    }

    offset += 16; // AAGUID
    const credentialIdLength = (authData[offset] << 8) + authData[offset + 1];
    offset += 2;
    offset += credentialIdLength;

    const credentialPublicKeyBytes = authData.slice(offset);
    if (!credentialPublicKeyBytes.length) {
      return null;
    }

    const coseStruct = cborDecode(credentialPublicKeyBytes, {
      useMaps: true,
    }) as Map<number, Uint8Array>;

    const xBytes = coseStruct.get(-2);
    const yBytes = coseStruct.get(-3);

    if (!xBytes || !yBytes) {
      return null;
    }

    const uncompressed = new Uint8Array(65);
    uncompressed[0] = 0x04;
    uncompressed.set(xBytes, 1);
    uncompressed.set(yBytes, 33);

    return uncompressed.buffer;
  } catch (error) {
    console.error("Erro ao extrair chave pública da attestation:", error);
    return null;
  }
}

// Função para autenticar com Passkey usando API nativa
export async function authenticatePasskey(
  credentialId: string
): Promise<PublicKeyCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn não é suportado neste navegador");
  }

  const options = createAuthenticationOptions(credentialId);
  const assertion = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential;

  if (!assertion) {
    throw new Error("Falha na autenticação");
  }

  return assertion;
}

// Função para gerar hash de transação mockado
export async function generateTransactionHash(
  recipient: string,
  amount: string
): Promise<string> {
  const data = `${recipient}-${amount}-${Date.now()}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
