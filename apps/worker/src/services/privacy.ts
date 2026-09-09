/**
 * Cryptographically hashes an IP address using HMAC-SHA256 and a secret salt.
 * Ensures privacy: raw IP addresses are never stored in the database or logs.
 */
export async function hashIpAddress(ip: string | undefined | null, salt: string): Promise<string | null> {
  if (!ip) {
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(salt || 'default-fallback-salt');
    const msgData = encoder.encode(ip.trim());

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    // Return first 32 characters of hex representation (128 bits of entropy is more than sufficient)
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  } catch {
    return null;
  }
}
