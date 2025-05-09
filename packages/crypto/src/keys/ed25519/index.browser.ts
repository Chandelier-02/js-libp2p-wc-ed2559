import { ed25519 as ed } from '@noble/curves/ed25519'
import { toString as uint8arrayToString } from 'uint8arrays/to-string'
import crypto from '../../webcrypto/index.js'
import type { Uint8ArrayKeyPair } from '../interface.js'
import type { Uint8ArrayList } from 'uint8arraylist'

const PUBLIC_KEY_BYTE_LENGTH = 32
const PRIVATE_KEY_BYTE_LENGTH = 64 // private key is actually 32 bytes but for historical reasons we concat private and public keys
const KEYS_BYTE_LENGTH = 32

export { PUBLIC_KEY_BYTE_LENGTH as publicKeyLength }
export { PRIVATE_KEY_BYTE_LENGTH as privateKeyLength }

export function generateKey (): Uint8ArrayKeyPair {
  // the actual private key (32 bytes)
  const privateKeyRaw = ed.utils.randomPrivateKey()
  const publicKey = ed.getPublicKey(privateKeyRaw)

  // concatenated the public key to the private key
  const privateKey = concatKeys(privateKeyRaw, publicKey)

  return {
    privateKey,
    publicKey
  }
}

/**
 * Generate keypair from a 32 byte uint8array
 */
export function generateKeyFromSeed (seed: Uint8Array): Uint8ArrayKeyPair {
  if (seed.length !== KEYS_BYTE_LENGTH) {
    throw new TypeError('"seed" must be 32 bytes in length.')
  } else if (!(seed instanceof Uint8Array)) {
    throw new TypeError('"seed" must be a node.js Buffer, or Uint8Array.')
  }

  // based on node forges algorithm, the seed is used directly as private key
  const privateKeyRaw = seed
  const publicKey = ed.getPublicKey(privateKeyRaw)

  const privateKey = concatKeys(privateKeyRaw, publicKey)

  return {
    privateKey,
    publicKey
  }
}

export function hashAndSign (privateKey: Uint8Array, msg: Uint8Array | Uint8ArrayList): () => Promise<Uint8Array> {
  let key: CryptoKey | null

  let privateKeyRaw: Uint8Array
  if (privateKey.length === PRIVATE_KEY_BYTE_LENGTH) {
    privateKeyRaw = privateKey.subarray(0, 32)
  } else {
    privateKeyRaw = privateKey
  }

  const jwk: JsonWebKey = {
    crv: 'Ed25519',
    kty: 'OKP',
    x: uint8arrayToString(privateKey.subarray(32), 'base64url'),
    d: uint8arrayToString(privateKeyRaw, 'base64url'),
    ext: true,
    key_ops: ['sign']
  }

  return async () => {
    key ??= await crypto.get().subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['sign'])

    const buffer = await crypto.get().subtle.sign({ name: 'Ed25519' }, key, msg instanceof Uint8Array ? msg : msg.subarray())
    return new Uint8Array(buffer, 0, buffer.byteLength)
  }
}

export function hashAndVerify (publicKey: Uint8Array, sig: Uint8Array, msg: Uint8Array | Uint8ArrayList): () => Promise<boolean> {
  let key: CryptoKey | null

  return async () => {
    key ??= await crypto.get().subtle.importKey('raw', publicKey.buffer, { name: 'Ed25519' }, false, ['verify'])
    const isValid = await crypto.get().subtle.verify({ name: 'Ed25519' }, key, sig, msg instanceof Uint8Array ? msg : msg.subarray())
    return isValid
  }
}

function concatKeys (privateKeyRaw: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const privateKey = new Uint8Array(PRIVATE_KEY_BYTE_LENGTH)
  for (let i = 0; i < KEYS_BYTE_LENGTH; i++) {
    privateKey[i] = privateKeyRaw[i]
    privateKey[KEYS_BYTE_LENGTH + i] = publicKey[i]
  }
  return privateKey
}
