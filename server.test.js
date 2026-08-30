const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = require("./server");

const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "vf_orders.json");
const EXPORT_TOKEN = "test-fmds-plan-export-token";

let originalOrdersFile;
let ordersFileExisted;

beforeAll(() => {
  ordersFileExisted = fs.existsSync(ORDERS_FILE);
  if (ordersFileExisted) {
    originalOrdersFile = fs.readFileSync(ORDERS_FILE);
  }
});

beforeEach(() => {
  process.env.FMDS_PLAN_EXPORT_TOKEN = EXPORT_TOKEN;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    ORDERS_FILE,
    JSON.stringify(
      [
        {
          id: "row-2",
          orderId: "MO-00722",
          sku: "FG-100",
          machine: "west_mac",
          start: "2026-09-01",
          end: "2026-09-02",
          due: "2026-09-03",
          qty: 4300,
          batches: 2,
          total: 8600,
          status: "scheduled",
          confirmed: true,
          priority: "high",
          category: "production",
          subcategory: "molding",
          region: "west",
          temper: "standard",
          notes: "Planner-visible note",
          actualQty: 1200,
          internalSecret: "must-not-export",
        },
        {
          id: "row-1",
          orderId: "TBD-ROASTER",
          sku: "RM-200",
          machine: "roaster",
          start: "2026-09-04",
          end: "2026-09-05",
          due: null,
          qty: "325.500",
          batches: "18",
          total: "5859.000",
          status: "draft",
          confirmed: false,
        },
      ],
      null,
      2,
    ),
  );
});

afterEach(() => {
  delete process.env.FMDS_PLAN_EXPORT_TOKEN;
});

afterAll(() => {
  if (ordersFileExisted) {
    fs.writeFileSync(ORDERS_FILE, originalOrdersFile);
  } else if (fs.existsSync(ORDERS_FILE)) {
    fs.unlinkSync(ORDERS_FILE);
  }
});

describe("Server", () => {
  describe("GET /health", () => {
    it("returns status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });

    it("returns JSON content type", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("GET /", () => {
    it("serves the index.html file", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toContain("Production Planner");
    });

    it("contains the login screen", async () => {
      const res = await request(app).get("/");
      expect(res.text).toContain('id="login-screen"');
    });

    it("contains the main app container", async () => {
      const res = await request(app).get("/");
      expect(res.text).toContain('id="main-app"');
    });
  });

  describe("Static files", () => {
    it("serves the CSV equipment model file", async () => {
      const res = await request(app).get("/Equipment%20Model-Table%201.csv");
      expect(res.status).toBe(200);
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(app).get("/nonexistent-route");
      expect(res.status).toBe(404);
    });
  });
});

describe("FMDS production plan export", () => {
  test("fails closed when no export token is configured", async () => {
    delete process.env.FMDS_PLAN_EXPORT_TOKEN;

    const response = await request(app)
      .get("/api/integrations/fmds/v1/production-plan")
      .set("Authorization", `Bearer ${EXPORT_TOKEN}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: "FMDS plan export is not configured",
    });
  });

  test.each([
    ["missing", undefined],
    ["malformed", "Basic abc123"],
    ["wrong", "Bearer wrong-token"],
  ])("rejects %s credentials", async (_label, authorization) => {
    const pendingRequest = request(app).get(
      "/api/integrations/fmds/v1/production-plan",
    );
    if (authorization) pendingRequest.set("Authorization", authorization);

    const response = await pendingRequest;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Unauthorized" });
  });

  test("returns only the versioned FMDS plan contract", async () => {
    const response = await request(app)
      .get("/api/integrations/fmds/v1/production-plan")
      .set("Authorization", `Bearer ${EXPORT_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(response.body).toMatchObject({
      ok: true,
      contractVersion: "1",
      source: "vf-production-scheduling",
      orderCount: 2,
      sourceRevision: expect.stringMatching(/^[a-f0-9]{64}$/),
      generatedAt: expect.any(String),
    });
    expect(response.body.orders).toEqual([
      {
        externalRowId: "row-2",
        orderId: "MO-00722",
        sku: "FG-100",
        machine: "west_mac",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        dueDate: "2026-09-03",
        batchQuantity: "4300",
        batchCount: "2",
        plannedQuantity: "8600",
        status: "scheduled",
        confirmed: true,
        priority: "high",
        category: "production",
        subcategory: "molding",
        region: "west",
        temper: "standard",
        notes: "Planner-visible note",
      },
      {
        externalRowId: "row-1",
        orderId: "TBD-ROASTER",
        sku: "RM-200",
        machine: "roaster",
        startDate: "2026-09-04",
        endDate: "2026-09-05",
        dueDate: null,
        batchQuantity: "325.500",
        batchCount: "18",
        plannedQuantity: "5859.000",
        status: "draft",
        confirmed: false,
        priority: null,
        category: null,
        subcategory: null,
        region: null,
        temper: null,
        notes: null,
      },
    ]);
    expect(response.body.orders[0]).not.toHaveProperty("actualQty");
    expect(response.body.orders[0]).not.toHaveProperty("internalSecret");
  });

  test("uses the source revision as an ETag", async () => {
    const firstResponse = await request(app)
      .get("/api/integrations/fmds/v1/production-plan")
      .set("Authorization", `Bearer ${EXPORT_TOKEN}`);

    const cachedResponse = await request(app)
      .get("/api/integrations/fmds/v1/production-plan")
      .set("Authorization", `Bearer ${EXPORT_TOKEN}`)
      .set("If-None-Match", firstResponse.headers.etag);

    expect(cachedResponse.status).toBe(304);
    expect(cachedResponse.headers.etag).toBe(firstResponse.headers.etag);
    expect(cachedResponse.text).toBe("");
  });
});
