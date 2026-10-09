import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

describe("Health API Endpoint (/api/health)", () => {
  it("returns 200 and connected status when database responds successfully", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }] as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data.timestamp).toBeDefined();

    vi.restoreAllMocks();
  });

  it("returns 503 and degraded status when database query fails", async () => {
    vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(
      new Error("Connection refused: 5432")
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.database).toBe("disconnected");
    expect(data.error).toContain("Connection refused");
    expect(data.timestamp).toBeDefined();

    vi.restoreAllMocks();
  });
});
