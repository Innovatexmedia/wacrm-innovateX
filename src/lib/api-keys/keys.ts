// ============================================================
// API key generation + hashing — pure, server-side, no Supabase.
//
// Mirrors the invite-token utilities in `src/lib/auth/invitations.ts`:
// the DB stores only the SHA-256 hash, the plaintext is shown to the
// creator exactly once. See migration 026 for the rationale.
//
// Why SHA-256 (not bcrypt/argon2)
//   API keys are full-entropy random strings (32 CSPRNG bytes), not
//   user-chosen passwords. There is no dictionary to attack and no
//   rainbow table that helps, so a slow KDF buys nothing — it would
//   only slow the per-request auth lookup. A fast hash with a UNIQUE
//   index is the correct, indexable choice for opaque secrets.
//
// Why the `innovatexmedia_live_` prefix
//   - Self-identifying: a leaked string is instantly recognisable as
//     an InnovateX Media key (handy for secret-scanners like
//     GitGuardian), and carries the product's own branding rather
//     than the open-source template's.
//   - Forward-compatible: leaves room for an `innovatexmedia_test_`
//     variant if a sandbox mode is ever added, without reshaping the
//     format.
//
// Rebrand note: this prefix used to be `wacrm_live_`. Every key
// issued before the rebrand is still a plain `wacrm_live_<body>`
// string sitting in someone's .env or password manager — there's no
// way to reach out and change it, and hashApiKey below only ever
// hashes whatever plaintext it's handed, so an old key's hash was
// computed from, and only ever matches, its original prefix. Renaming
// this constant alone would make looksLikeApiKey() (below) reject
// every key issued before today at the door, before hashing is even
// attempted — an outage for anyone already using this API, not a
// cosmetic rename. LEGACY_API_KEY_PREFIXES keeps those working:
// looksLikeApiKey() accepts either prefix, while generateApiKey()
// below only ever produces the new one — so new keys are fully
// rebranded, and old ones keep working for as long as anyone's still
// using them.
// ============================================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Secret prefix on every NEWLY GENERATED key. Part of the plaintext,
 *  not a secret. */
export const API_KEY_PREFIX = 'innovatexmedia_live_';

/**
 * Prefixes from before the InnovateX rebrand — still valid for keys
 * already issued under them. Never used to generate a new key; only
 * checked in looksLikeApiKey() so an old key isn't rejected outright.
 * If this product is ever rebranded again, add the retiring prefix
 * here rather than removing anything — the same reasoning applies.
 */
const LEGACY_API_KEY_PREFIXES = ['wacrm_live_'] as const;

/**
 * Length of the non-secret display prefix stored in `key_prefix` and
 * shown in the dashboard: the literal prefix plus the first 8 chars
 * of the random body. Enough to tell two keys apart at a glance,
 * far too little to brute-force the remaining ~248 bits.
 */
const DISPLAY_BODY_CHARS = 8;

export interface GeneratedApiKey {
  /** Plaintext key — return to the creator ONCE, never persist. */
  plaintext: string;
  /** SHA-256 hex digest. Persist this in `api_keys.key_hash`. */
  hash: string;
  /** Non-secret display string. Persist this in `api_keys.key_prefix`. */
  prefix: string;
}

/**
 * Generate a fresh API key + its hash + its display prefix. Call
 * once per key creation; the plaintext is shown to the admin in the
 * creation modal and never again. Always uses the current (rebranded)
 * API_KEY_PREFIX — never a legacy one.
 */
export function generateApiKey(): GeneratedApiKey {
  // 32 bytes of CSPRNG entropy. base64url keeps it URL/header-safe
  // and shorter than hex (43 vs 64 chars).
  const body = randomBytes(32).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${body}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: `${API_KEY_PREFIX}${body.slice(0, DISPLAY_BODY_CHARS)}`,
  };
}

/**
 * Deterministic SHA-256 of a plaintext key. Used at auth time to
 * look up the matching `api_keys` row by `key_hash`. Pure — same
 * input always produces the same output. Prefix-agnostic: hashes
 * whatever string it's given, which is exactly why an old
 * `wacrm_live_` key's stored hash still matches when that same old
 * plaintext is presented again — nothing about a rebrand touches
 * already-stored hashes.
 */
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Structural check that a string looks like one of our keys before
 * we bother hashing + hitting the DB. Cheap reject for obviously
 * malformed `Authorization` headers (e.g. a stale invite token).
 * Accepts the current prefix AND any legacy one, so a key issued
 * before the InnovateX rebrand isn't rejected here before its hash
 * even gets checked.
 */
export function looksLikeApiKey(value: string): boolean {
  return [API_KEY_PREFIX, ...LEGACY_API_KEY_PREFIXES].some(
    (prefix) => value.startsWith(prefix) && value.length > prefix.length
  );
}

/**
 * Constant-time comparison of two hex digests. The lookup is by an
 * indexed UNIQUE column so an attacker can't easily probe timing,
 * but comparing the hashes in constant time anyway costs nothing and
 * removes the question. Returns false on any length mismatch (the
 * underlying `timingSafeEqual` throws on unequal lengths).
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}