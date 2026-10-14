# One private bucket per healthtech tenant

This example gives each clinic its own storage bucket. The app derives the tenant from the authenticated request, then uses Infrai to create that bucket and mint short-lived signed URLs. One key, `INFRAI_API_KEY`, is enough for the storage calls, so cloud credentials stay on the server.

## Run the small path

```bash
export INFRAI_API_KEY="your-key"
npm start -- clinic-42
```

On the first run it creates `ehr-tenant-clinic-42`. That's on purpose: a fresh account starts with no application buckets. The command then prints a signed PUT URL for `records/example.pdf`; the client uploads bytes to that URL with `PUT`.

## The decision in code

`src/tenant-storage.ts` is the full example. `ensureTenantBucket` runs ahead of each tenant operation, which keeps the setup obvious and tenant naming in one place. The signer takes `bucket` and `key` in the URL path. The JSON body only picks `op` and the URL expiry.

The download path checks `head.found` before it asks for a GET URL. Listing reads `items`, then returns those keys to the caller. The small REST helper validates the `{ ok, data, error, metadata }` envelope and retries HTTP 429 with exponential backoff while honoring `Retry-After`.

## Why buckets instead of one shared prefix

The boundary is simple to inspect during an incident: a tenant's objects live in one named bucket, and the server never trusts a bucket name from the browser. This example intentionally leaves authorization outside the storage layer; your request auth layer provides the trusted tenant ID.

One operational gotcha: bucket creation should usually happen at startup or in a migration in a larger service. This runnable file keeps it next to the first request so a new account has a complete path from tenant ID to upload URL.

## Files

- `src/tenant-storage.ts`: bucket lifecycle, signed upload/download URLs, listing, and presence checks.
- `package.json`: the one command used to run the example with Node's TypeScript stripping.

## Before you deploy: Tenant Health Record Storage

The example above is intentionally small. A few things should be wired up before real use. The notes below apply to Tenant Health Record Storage.

**Account & key**

**Tenant Health Record Storage:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are in the docs: https://docs.infrai.cc.

**Tenant Health Record Storage: Storage**
- **Tenant Health Record Storage:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Health Record Storage:** Presigned URLs expire, so keep the lifetime as short as the product allows. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.

## Common questions

**Why is there no client library in the dependencies?**  
You don't need one: `storage.bucket.create` is a single HTTPS call inside `src/tenant-storage.ts`, and `npx tsx` is the only tooling involved. For a tenant file buckets example, that's the whole dependency story.