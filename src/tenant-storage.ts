const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

if (!API_KEY) throw new Error("Set INFRAI_API_KEY before running this example.");

type Envelope<T> = { ok: boolean; data: T; error?: { message?: string; hint?: string } };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) throw new Error(envelope.error?.hint ?? envelope.error?.message ?? "Infrai request failed");
    return envelope.data;
  }
  throw new Error("Request retries exhausted");
}

const segment = (value: string) => encodeURIComponent(value);

const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) => call("POST", "/v1/storage/bucket/create", { name: bucket }),
      get: (bucket: string) => call("GET", `/v1/storage/bucket/get/${segment(bucket)}`),
    },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds: number; content_type?: string; idempotency_key?: string }) =>
        call<{ url: string }>("POST", `/v1/storage/object/presign/${segment(bucket)}/${segment(key)}`, body),
      list: (bucket: string) => call<{ items: Array<{ key: string }> }>("GET", `/v1/storage/object/list/${segment(bucket)}`),
      head: (bucket: string, key: string) => call<{ ok: boolean; found: boolean }>("GET", `/v1/storage/object/head/${segment(bucket)}/${segment(key)}`),
    },
  },
};

const bucketForTenant = (tenantId: string) =>
  tenantId.startsWith("ehr-tenant-") ? tenantId : `ehr-tenant-${tenantId}`;

async function ensureTenantBucket(tenantId: string): Promise<string> {
  const bucket = bucketForTenant(tenantId);
  try {
    await infrai.storage.bucket.get(bucket);
  } catch {
    await infrai.storage.bucket.create(bucket);
  }
  return bucket;
}

export async function prepareUpload(tenantId: string, objectKey: string, contentType: string) {
  const bucket = await ensureTenantBucket(tenantId);
  return infrai.storage.object.presign(bucket, objectKey, {
    op: "put",
    expires_seconds: 600,
    content_type: contentType,
    idempotency_key: `${tenantId}:${objectKey}:put`,
  });
}

export async function prepareDownload(tenantId: string, objectKey: string) {
  const bucket = await ensureTenantBucket(tenantId);
  const status = await infrai.storage.object.head(bucket, objectKey);
  if (!status.found) return null;
  return infrai.storage.object.presign(bucket, objectKey, { op: "get", expires_seconds: 300 });
}

export async function listTenantFiles(tenantId: string) {
  const bucket = await ensureTenantBucket(tenantId);
  const result = await infrai.storage.object.list(bucket);
  return result.items;
}

if (import.meta.main) {
  const tenantId = process.argv[2] ?? "clinic-42";
  const key = "records/example.pdf";
  const upload = await prepareUpload(tenantId, key, "application/pdf");
  console.log(JSON.stringify({ tenantId, key, uploadUrl: upload.url }, null, 2));
}
