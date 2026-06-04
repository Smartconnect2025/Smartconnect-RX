import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the inbound RedSail (Emporos) webhook receiver.
 *
 * These run entirely against the deterministic mock adapter and an in-memory
 * fake of the Supabase admin client — no network, no real credentials, and no
 * money movement. The mock adapter derives its webhook bearer from the stored
 * OIDC client secret (sha256("redsail-mock:" + secret)), so the tests can mint a
 * valid bearer for a given config without any external issuer.
 */

const h = vi.hoisted(() => ({
  state: {
    db: null as InMemoryDb | null,
    configRegistry: new Map<string, DecryptedRedsailConfig[]>(),
  },
}));

vi.mock("@/core/config/envConfig", () => ({
  envConfig: { REDSAIL_ENABLED: true },
}));

vi.mock("@core/database/client", () => ({
  createAdminClient: () => makeClient(h.state.db as InMemoryDb),
}));

vi.mock("@/core/services/redsailPaymentConfigService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/core/services/redsailPaymentConfigService")
    >();
  return {
    ...actual,
    getRedsailConfigsForPharmacy: async (pharmacyId: string) =>
      h.state.configRegistry.get(pharmacyId) ?? [],
  };
});

import { POST } from "./route";
import type { DecryptedRedsailConfig } from "@/core/services/redsailPaymentConfigService";

// ---------------------------------------------------------------------------
// In-memory Supabase fake
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type InMemoryDb = Record<string, Row[]>;

interface Filter {
  type: "eq" | "in";
  col: string;
  val?: unknown;
  vals?: unknown[];
}

function pick(row: Row, cols: string): Row {
  if (!cols || cols.trim() === "*") return { ...row };
  const wanted = cols.split(",").map((c) => c.trim());
  const out: Row = {};
  for (const c of wanted) out[c] = row[c];
  return out;
}

class QueryBuilder {
  private _op: "select" | "insert" | "update" = "select";
  private _selectCols = "*";
  private _returnSelect: string | null = null;
  private _insertRow: Row | null = null;
  private _values: Row | null = null;
  private _filters: Filter[] = [];
  private _single = false;

  constructor(
    private readonly db: InMemoryDb,
    private readonly table: string,
  ) {}

  select(cols = "*") {
    if (this._op === "insert" || this._op === "update") {
      this._returnSelect = cols;
    } else {
      this._op = "select";
      this._selectCols = cols;
    }
    return this;
  }

  insert(row: Row) {
    this._op = "insert";
    this._insertRow = row;
    return this;
  }

  update(values: Row) {
    this._op = "update";
    this._values = values;
    return this;
  }

  eq(col: string, val: unknown) {
    this._filters.push({ type: "eq", col, val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._filters.push({ type: "in", col, vals });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  private rows(): Row[] {
    if (!this.db[this.table]) this.db[this.table] = [];
    return this.db[this.table];
  }

  private match(row: Row): boolean {
    return this._filters.every((f) => {
      if (f.type === "eq") return row[f.col] === f.val;
      if (f.type === "in") return (f.vals ?? []).includes(row[f.col]);
      return true;
    });
  }

  private run() {
    const rows = this.rows();

    if (this._op === "insert") {
      const insertRow = this._insertRow as Row;
      // Emulate the unique constraint on redsail_webhook_events.event_id.
      if (this.table === "redsail_webhook_events") {
        const dup = rows.find((r) => r.event_id === insertRow.event_id);
        if (dup) {
          return {
            data: null,
            error: {
              code: "23505",
              message:
                "duplicate key value violates unique constraint \"redsail_webhook_events_event_id_key\"",
            },
          };
        }
      }
      const newRow = { ...insertRow };
      rows.push(newRow);
      if (this._returnSelect) {
        return { data: [pick(newRow, this._returnSelect)], error: null };
      }
      return { data: null, error: null };
    }

    if (this._op === "update") {
      const matched = rows.filter((r) => this.match(r));
      for (const r of matched) Object.assign(r, this._values);
      if (this._returnSelect) {
        return {
          data: matched.map((r) => pick(r, this._returnSelect as string)),
          error: null,
        };
      }
      return { data: null, error: null };
    }

    // select
    const matched = rows.filter((r) => this.match(r));
    if (this._single) {
      if (matched.length === 0) {
        return { data: null, error: { code: "PGRST116", message: "no rows" } };
      }
      return { data: pick(matched[0], this._selectCols), error: null };
    }
    return {
      data: matched.map((r) => pick(r, this._selectCols)),
      error: null,
    };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

function makeClient(db: InMemoryDb) {
  return {
    from(table: string) {
      return new QueryBuilder(db, table);
    },
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function bearerFor(secret: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`redsail-mock:${secret}`)
    .digest("hex");
  return `Bearer ${hash}`;
}

function makeConfig(
  pharmacyId: string,
  oidcClientSecret: string,
): DecryptedRedsailConfig {
  return {
    id: `cfg-${pharmacyId}`,
    pharmacyId,
    environment: "ftr1",
    isActive: true,
    isConnected: true,
    label: null,
    tenantId: `tenant-${pharmacyId}`,
    oidcClientId: `client-${pharmacyId}`,
    oidcClientSecret,
    linkToPayAuthMode: "SingleUseToken",
  };
}

function registerPharmacy(
  db: InMemoryDb,
  pharmacyId: string,
  oidcClientSecret: string,
) {
  db.redsail_payment_configs.push({
    id: `cfg-${pharmacyId}`,
    pharmacy_id: pharmacyId,
    is_active: true,
    is_connected: true,
  });
  h.state.configRegistry.set(pharmacyId, [
    makeConfig(pharmacyId, oidcClientSecret),
  ]);
}

function makeRequest(body: unknown, bearer: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (bearer) headers.authorization = bearer;
  return new Request("http://localhost/api/webhooks/redsail", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.state.db = { redsail_payment_configs: [] } as InMemoryDb;
  h.state.configRegistry = new Map();
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.REDSAIL_ADAPTER = "mock";
});

function db(): InMemoryDb {
  return h.state.db as InMemoryDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RedSail webhook receiver", () => {
  const SECRET_A = "secret-pharmacy-a";

  it("completes a pending transaction once for a valid bearer", async () => {
    registerPharmacy(db(), "pharm-a", SECRET_A);
    db().payment_transactions = [
      {
        id: "txn-1",
        pharmacy_id: "pharm-a",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-1",
        prescription_id: "rx-1",
      },
    ];
    db().prescriptions = [
      { id: "rx-1", payment_transaction_id: "txn-1", payment_status: "unpaid" },
    ];

    const res = await POST(
      makeRequest(
        {
          eventId: "evt-1",
          eventType: "payment.success",
          transactionId: "rs-txn-1",
        },
        bearerFor(SECRET_A),
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });

    const txn = db().payment_transactions.find((t) => t.id === "txn-1");
    expect(txn?.payment_status).toBe("completed");
    expect(txn?.order_progress).toBe("pharmacy_processing");

    const rx = db().prescriptions.find((r) => r.id === "rx-1");
    expect(rx?.payment_status).toBe("paid");

    const ledger = db().redsail_webhook_events.find(
      (e) => e.event_id === "evt-1",
    );
    expect(ledger?.status).toBe("processed");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/prescriptions/rx-1/submit-to-pharmacy",
    );
  });

  it("skips a duplicate event without reprocessing", async () => {
    registerPharmacy(db(), "pharm-a", SECRET_A);
    db().payment_transactions = [
      {
        id: "txn-1",
        pharmacy_id: "pharm-a",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-1",
        prescription_id: "rx-1",
      },
    ];
    db().prescriptions = [
      { id: "rx-1", payment_transaction_id: "txn-1", payment_status: "unpaid" },
    ];

    const payload = {
      eventId: "evt-dup",
      eventType: "payment.success",
      transactionId: "rs-txn-1",
    };

    const first = await POST(makeRequest(payload, bearerFor(SECRET_A)));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ received: true });

    const second = await POST(makeRequest(payload, bearerFor(SECRET_A)));
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    // Only the first delivery should have triggered pharmacy submission.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Ledger has exactly one entry for the event.
    expect(
      db().redsail_webhook_events.filter((e) => e.event_id === "evt-dup").length,
    ).toBe(1);
  });

  it("retries a previously-failed event", async () => {
    registerPharmacy(db(), "pharm-a", SECRET_A);
    db().payment_transactions = [
      {
        id: "txn-1",
        pharmacy_id: "pharm-a",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-1",
        prescription_id: "rx-1",
      },
    ];
    db().prescriptions = [
      { id: "rx-1", payment_transaction_id: "txn-1", payment_status: "unpaid" },
    ];
    // A prior delivery left an "error" ledger entry — the retry must proceed.
    db().redsail_webhook_events = [
      {
        event_id: "evt-retry",
        event_type: "payment.success",
        payload: {},
        status: "error",
        error: "transient failure",
      },
    ];

    const res = await POST(
      makeRequest(
        {
          eventId: "evt-retry",
          eventType: "payment.success",
          transactionId: "rs-txn-1",
        },
        bearerFor(SECRET_A),
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });

    const txn = db().payment_transactions.find((t) => t.id === "txn-1");
    expect(txn?.payment_status).toBe("completed");

    const ledger = db().redsail_webhook_events.find(
      (e) => e.event_id === "evt-retry",
    );
    expect(ledger?.status).toBe("processed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces tenant isolation across pharmacies", async () => {
    const SECRET_B = "secret-pharmacy-b";
    registerPharmacy(db(), "pharm-a", SECRET_A);
    registerPharmacy(db(), "pharm-b", SECRET_B);

    // The transaction belongs to pharmacy B...
    db().payment_transactions = [
      {
        id: "txn-b",
        pharmacy_id: "pharm-b",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-b",
        prescription_id: "rx-b",
      },
    ];
    db().prescriptions = [
      { id: "rx-b", payment_transaction_id: "txn-b", payment_status: "unpaid" },
    ];

    // ...but the bearer is pharmacy A's. A's bearer validates, then the tenant
    // guard must refuse to act on B's transaction.
    const res = await POST(
      makeRequest(
        {
          eventId: "evt-cross",
          eventType: "payment.success",
          transactionId: "rs-txn-b",
        },
        bearerFor(SECRET_A),
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });

    const txn = db().payment_transactions.find((t) => t.id === "txn-b");
    expect(txn?.payment_status).toBe("pending");

    const rx = db().prescriptions.find((r) => r.id === "rx-b");
    expect(rx?.payment_status).toBe("unpaid");

    const ledger = db().redsail_webhook_events.find(
      (e) => e.event_id === "evt-cross",
    );
    expect(ledger?.status).toBe("ignored");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    registerPharmacy(db(), "pharm-a", SECRET_A);
    db().payment_transactions = [
      {
        id: "txn-1",
        pharmacy_id: "pharm-a",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-1",
      },
    ];

    const res = await POST(
      makeRequest(
        {
          eventId: "evt-bad",
          eventType: "payment.success",
          transactionId: "rs-txn-1",
        },
        "Bearer totally-wrong",
      ),
    );

    expect(res.status).toBe(401);
    const txn = db().payment_transactions.find((t) => t.id === "txn-1");
    expect(txn?.payment_status).toBe("pending");
  });

  it("ignores a non-success event", async () => {
    registerPharmacy(db(), "pharm-a", SECRET_A);
    db().payment_transactions = [
      {
        id: "txn-1",
        pharmacy_id: "pharm-a",
        payment_status: "pending",
        redsail_transaction_id: "rs-txn-1",
      },
    ];

    const res = await POST(
      makeRequest(
        {
          eventId: "evt-pending",
          eventType: "payment.pending",
          transactionId: "rs-txn-1",
        },
        bearerFor(SECRET_A),
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });

    const txn = db().payment_transactions.find((t) => t.id === "txn-1");
    expect(txn?.payment_status).toBe("pending");

    const ledger = db().redsail_webhook_events.find(
      (e) => e.event_id === "evt-pending",
    );
    expect(ledger?.status).toBe("ignored");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
