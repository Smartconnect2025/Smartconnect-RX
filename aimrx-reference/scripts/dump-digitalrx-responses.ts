import { createAdminClient } from "@core/database/client";
import {
  resolvePharmacyBackend,
} from "@/app/api/prescriptions/_shared/digitalrx-helpers";

const GREENWICH = "59623278-013e-407f-96af-b164144bdbc7";

async function rawCall(baseUrl: string, storeId: string, apiKey: string, queueId: string) {
  const url = `${baseUrl}/RxRequestStatus`;
  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ StoreID: storeId, QueueID: queueId }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return { networkError: (e as Error).message, ms: Date.now() - t0 };
  }
  const text = await resp.text();
  return {
    httpStatus: resp.status,
    httpStatusText: resp.statusText,
    contentType: resp.headers.get("content-type"),
    bodyLength: text.length,
    body: text,
    ms: Date.now() - t0,
  };
}

async function main() {
  const supabase = createAdminClient();
  const backend = await resolvePharmacyBackend(supabase, GREENWICH);
  if (!backend) {
    console.error("No Greenwich backend resolved");
    process.exit(1);
  }
  const queueIds = [
    "2233282", // Brian Bielot — last known PAUSED
    "2222233", // Scott Province
    "2209939", // Michael Paesani
    "2226003", // Sunny Haynes
    "2199336", // Charles Koch
    "2203179", // Michael Landow
    "2198891", // Amanda Chase
    "2259024", // Jessica Carroll
    "2252742", // Jason Johnson
    "2226877", // Kourtney Duffie
  ];
  const results: Record<string, unknown> = {};
  for (const qid of queueIds) {
    const r = await rawCall(backend.baseUrl, backend.storeId, backend.apiKey, qid);
    results[qid] = r;
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
