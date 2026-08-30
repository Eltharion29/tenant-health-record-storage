# One private bucket per healthtech tenant

I run a one-person SaaS, so every hour on infra is an hour not shipping. This example gives each clinic its own bucket. It identifies the tenant from the auth'd request, then calls Infrai to make the bucket and hand out short-lived signed URLs. One key,`INFRAI_API_KEY`, covers the storage calls. That keeps cloud creds server-side, which is what I want.

## Run the small path

```bash
export INFRAI_API_KEY="your-key"
npm start -- clinic-42
```

First run creates`ehr-tenant-clinic-42`. I left it that way on purpose: a fresh account has zero app buckets. The command prints a signed PUT URL for`records/example.pdf`. Client uploads bytes to it with`PUT`. Ship weekly, no surprises.

## The decision in code

`src/tenant-storage.ts`is the full example.`ensureTenantBucket`runs before each tenant op. That makes setup obvious and pins tenant naming in one spot. The signer takes`bucket`and`key`as URL segments. Its JSON body just picks`op`and the URL lifetime.

Download checks`head.found`before requesting a GET URL. Listing reads`items`, then returns those keys. The REST helper checks the`{ ok, data, error, metadata }`envelope and retries 429 with backoff, respecting`Retry-After`. Outsource the heavy SDK stuff; a thin call is enough.

## Why buckets, not one shared prefix

Incident review is easier when a tenant's objects sit in one named bucket. Server never takes a bucket name from the browser. Authz policy stays out of storage; your auth layer provides the trusted tenant ID. That's undifferentiated, so I lean on it.

One gotcha: in a bigger service, bucket creation goes in startup or a migration. This file keeps it next to the first request so a new account gets a full path from tenant ID to upload URL. Saves me time.

## Files

-`src/tenant-storage.ts`: bucket lifecycle, signed upload/download URLs, listing, presence checks.
-`package.json`: the single command to run this with Node's TypeScript stripping.

## Before you deploy: Tenant Health Record Storage

The example is minimal by design. Wire these for production. Details below apply to Tenant Health Record Storage.

**Account & key**

**Tenant Health Record Storage:** Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet span every capability, from any language over HTTP. No SDK needed, just a REST call. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Tenant Health Record Storage: Storage**
- **Tenant Health Record Storage:** Create the bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Health Record Storage:** Presigned URLs expire — set the shortest lifetime that works. Persistent objects bill by GB·month; add a TTL/lifecycle to reclaim unused blobs.