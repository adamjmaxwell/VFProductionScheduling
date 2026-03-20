const request = require("supertest");
const app = require("./server");

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
