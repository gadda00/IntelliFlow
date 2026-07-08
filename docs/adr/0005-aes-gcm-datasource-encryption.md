# ADR-0005: AES-GCM datasource encryption

## Status

Accepted

## Context

Busara lets users register **data sources** — Postgres connections,
S3 buckets, BigQuery datasets, etc. — and then run analyses against
them. Each data source's connection config contains secrets:

- Database passwords
- AWS access keys + secret keys
- OAuth refresh tokens
- Service-account JSON

These secrets must be stored (so the user doesn't re-enter them every
run) but they cannot be stored in plaintext — a database leak would
expose every customer's source credentials. The threat model is:

1. **Database compromise.** An attacker with read access to the
   `DataSource` table must not be able to use the credentials.
2. **Server compromise.** An attacker with read access to the
   application's env vars must not be able to decrypt credentials
   they're not authorized to access (per-tenant encryption is a
   future goal; for now, single-key is acceptable).
3. **Insider threat.** A developer with prod DB access must not be
   able to casually read customer credentials. Encryption at rest
   with a key they don't have is the minimum bar.
4. **Audit.** Every decryption must be logged (who, when, which
   data source).

The system also had to be **simple to operate**. We're a small team.
We can't run a HSM. We can't manage a per-customer KMS hierarchy. We
need something that works on a single Postgres instance and a single
encryption key, with a clear upgrade path to KMS later.

## Decision

Encrypt every `DataSource.config` JSON blob with **AES-256-GCM** before
writing it to the database. Decrypt on read, in the application process.

### Key management

- A single 256-bit key is generated at deploy time with
  `openssl rand -hex 32` and stored in the `DATA_SOURCE_ENCRYPTION_KEY`
  environment variable.
- The key is **never logged**, **never sent to the client**, and
  **never written to disk** outside of the env var.
- On boot, the app asserts the key is present and 64 hex chars (32
  bytes). If not, it crashes with a clear error.
- The key can be rotated by setting `DATA_SOURCE_ENCRYPTION_KEY_PREVIOUS`
  to the old key and `DATA_SOURCE_ENCRYPTION_KEY` to the new one. The
  decryptor tries the current key first, then the previous. Re-encrypt
  on next write.

### Encryption format

Each encrypted value is stored as a single string:

```
v1:<base64(iv)>:<base64(ciphertext)>:<base64(authTag)>
```

- `v1` — version prefix, so we can change the format later.
- `iv` — 12-byte initialization vector, randomly generated per
  encryption. Random IV is critical for GCM — reusing an IV with the
  same key leaks the auth key.
- `ciphertext` — the encrypted JSON.
- `authTag` — 16-byte GCM authentication tag. Detects tampering.

### API surface

The `lib/security/crypto.ts` module exposes:

- `encrypt(plaintext: string): string` — returns the `v1:...` string.
- `decrypt(encrypted: string): string` — throws `DecryptionError` on
  tampering, wrong key, or malformed input.
- `rotateKey(encrypted: string): string` — decrypts with current key,
  re-encrypts with current key. Used during key rotation.

The `DataSource` Prisma model stores `configEncrypted: string` (the
`v1:...` blob). The API route handlers decrypt on read, encrypt on
write. The decrypted config never appears in API responses.

### Audit

Every call to `decrypt()` is logged to the audit table with the
caller's user ID, the data source ID, and the timestamp. The audit log
is queryable via `/api/audit`.

## Consequences

**Positive:**

- A database dump is useless without the env var. The blast radius of
  a DB leak is dramatically reduced.
- AES-GCM is **authenticated encryption** — tampering with the
  ciphertext is detected on decrypt. An attacker can't silently
  substitute their own connection config.
- The version prefix means we can change the format (e.g. to
  XChaCha20-Poly1305) without a flag day. Old values still decrypt.
- Key rotation is operational, not a code change. Set the env vars,
  restart, re-encrypt on next write.
- The audit trail satisfies compliance requirements (SOC 2, ISO 27001)
  without a separate logging pipeline.

**Negative:**

- A single key for all customers. If the key leaks, every data source
  is exposed. Mitigation: per-tenant keys (wrapped by a master key) is
  on the roadmap.
- Key loss is catastrophic. If `DATA_SOURCE_ENCRYPTION_KEY` is lost,
  every data source is unrecoverable. Mitigation: the key is stored in
  the secrets manager (AWS Secrets Manager, Doppler, etc.), not in Git.
- The decrypt step adds ~1 ms per data source per request. Negligible
  for our scale; would matter at 100 000 req/s.
- No field-level encryption. The entire `config` blob is encrypted as
  a unit. If we wanted to query "all data sources using Postgres", we'd
  need a separate plaintext `type` column. We do — `DataSource.type`
  is plaintext.
- The audit log grows unbounded. We need a retention policy. Currently
  capped at 1 M rows with FIFO eviction.

## Alternatives Considered

- **Plaintext in DB.** Rejected immediately. A DB leak exposes every
  customer's source credentials.
- **Symmetric encryption with a fixed IV.** Catastrophic. Reusing an
  IV with GCM leaks the auth key. We use a random IV per encryption.
- **AES-CBC.** Not authenticated. An attacker can flip bits in the
  ciphertext and have predictable changes in the plaintext (padding
  oracle, etc.). GCM is strictly better.
- **ChaCha20-Poly1305.** Excellent choice — slightly faster in
  software, no hardware acceleration needed. We chose AES-GCM because
  Node's `crypto` module has it built-in and hardware acceleration is
  ubiquitous on the servers we deploy to. The format is versioned; we
  can switch later.
- **Postgres `pgcrypto`.** Tempting (DB-native), but it puts the key
  in the DB and doesn't support authenticated encryption cleanly. We
  want the key in the app's env, not in the DB.
- **AWS KMS / GCP KMS per-customer keys.** The right long-term answer
  for multi-tenant SaaS. Adds latency (~50 ms per decrypt) and cost
  ($1 per 10 000 decrypts). For our scale, a single app-held key is
  simpler. The version-prefix format means we can migrate to KMS
  without a flag day.
- **HashiCorp Vault.** Excellent for key management, but it's another
  service to operate. We'd consider it if we had more secrets to
  manage (DB credentials, API keys, etc.). For now, env vars + a
  secrets manager (Doppler / AWS Secrets Manager) is enough.
- **No encryption, rely on DB-level TDE (transparent data encryption).**
  TDE protects against disk theft but not against DB compromise (the
  DB process can read everything). Application-level encryption is
  stronger because it protects against DB read access.
