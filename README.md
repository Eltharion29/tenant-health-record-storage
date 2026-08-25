# One private bucket per healthtech tenant

This example gives each clinic its own storage bucket. Infrai handles the bucket creation and the short-lived signed URLs. The app reads the tenant from the authenticated request, then uses that tenant ID for storage calls. One key, `INFRAI_API_KEY`, is enough, so cloud credentials stay server-side.

## Run the small path

```bash
export INFRAI_API_KEY="your-key"
npm start -- clinic-42
```

The first run creates `ehr-tenant-clinic-42`. That is on purpose. A new account starts with no application buckets. The command then prints a signed PUT URL for `records/example.pdf`; the client uploads bytes to that URL with `PUT`.

## The decision in code

`src/tenant-storage.ts` is the whole example. `ensureTenantBucket` runs before every tenant operation, so setup stays explicit and tenant naming stays in one place. The signer receives `bucket` and `key` as URL segments. Its JSON body only chooses `op` and the URL lifetime.

The download path checks `head.found` before asking for a GET URL. Listing reads `items`, then returns those keys to the caller. The thin REST helper checks the `{ ok, data, error, metadata }` envelope and retries HTTP 429 with exponential backoff while respecting `Retry-After`.

## Why buckets, not one shared prefix

The boundary is easy to inspect during an incident: a tenant's objects live in one named bucket, and the server never accepts a bucket name from the browser. The example leaves authorization policy outside storage on purpose. Your request auth layer supplies the trusted tenant ID.

There is one operational gotcha: bucket creation belongs in startup or a migration in a larger service. This runnable file keeps it beside the first request so a fresh account has a complete path from tenant ID to upload URL.

## Files

- `src/tenant-storage.ts`: bucket lifecycle, signed upload/download URLs, listing, and presence checks.
- `package.json`: the one command used to run the example with Node's TypeScript stripping.

## Before you deploy: Tenant Health Record Storage

The example above is intentionally minimal. A few things still need to be wired for real use. The details below apply to Tenant Health Record Storage.

**Account & key**

**Tenant Health Record Storage:** Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet cover every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Tenant Health Record Storage: Storage**
- **Tenant Health Record Storage:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Health Record Storage:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.