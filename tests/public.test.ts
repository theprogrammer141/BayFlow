import { describe, it, expect } from "vitest";
import { createUser, createShop, createService } from "./factories";
import { getPublicShops, getPublicShopById } from "@/lib/services/public";
import { NotFoundError } from "@/lib/errors";

describe("Public Shop Discovery APIs", () => {
  it("returns public shops with services and rating placeholder, filtering by city and search query", async () => {
    const owner = await createUser({ name: "Public Owner" });

    // Shop 1: Lahore
    const shopLhr = await createShop(owner.id, {
      name: "Apex Precision Auto",
      city: "Lahore",
      address: "Gulberg III",
      phone: "+924235780001",
      workStart: "09:00",
      workEnd: "19:00",
      slotMinutes: 60,
      slotCapacity: 3,
    });
    await createService(shopLhr.id, {
      name: "Engine Tune-up",
      estMinutes: 90,
      basePrice: 8500,
    });
    await createService(shopLhr.id, {
      name: "Wheel Alignment",
      estMinutes: 45,
      basePrice: 3000,
    });

    const uniqueSuffix = Date.now().toString(36);
    const breezeName = `Sea Breeze ${uniqueSuffix}`;
    const blueAreaAddress = `Blue Area ${uniqueSuffix}`;

    // Shop 2: Karachi
    const shopKhi = await createShop(owner.id, {
      name: breezeName,
      city: "Karachi",
      address: "Shahrah-e-Faisal",
      phone: "+922134560002",
      workStart: "08:30",
      workEnd: "18:00",
      slotMinutes: 45,
      slotCapacity: 2,
    });
    await createService(shopKhi.id, {
      name: "AC Gas Refill",
      estMinutes: 60,
      basePrice: 4500,
    });

    // Shop 3: Islamabad
    const shopIsb = await createShop(owner.id, {
      name: `Margalla ${uniqueSuffix}`,
      city: "Islamabad",
      address: blueAreaAddress,
      phone: "+92512340003",
    });

    // 1. Unfiltered query
    const allShops = await getPublicShops({});
    expect(allShops.length).toBeGreaterThanOrEqual(3);
    const foundLhr = allShops.find((s) => s.id === shopLhr.id);
    expect(foundLhr).toBeDefined();
    expect(foundLhr?.rating).toBe(4.8);
    expect(foundLhr?.services?.length).toBe(2);
    expect(foundLhr?.services?.map((s) => s.name)).toContain("Engine Tune-up");
    // Verify no private fields are leaked
    expect((foundLhr as Record<string, unknown>).ownerId).toBeUndefined();

    // 2. Filter by city: 'lahore' (case-insensitive)
    const lhrResults = await getPublicShops({ city: "lahore" });
    const lhrIds = lhrResults.map((s) => s.id);
    expect(lhrIds).toContain(shopLhr.id);
    expect(lhrIds).not.toContain(shopKhi.id);
    expect(lhrIds).not.toContain(shopIsb.id);

    // 3. Filter by search text
    const searchBreeze = await getPublicShops({ q: breezeName });
    const breezeIds = searchBreeze.map((s) => s.id);
    expect(breezeIds).toContain(shopKhi.id);
    expect(breezeIds).not.toContain(shopLhr.id);

    // 4. Filter by address term
    const searchAddress = await getPublicShops({ q: blueAreaAddress });
    const addressIds = searchAddress.map((s) => s.id);
    expect(addressIds).toContain(shopIsb.id);
    expect(addressIds).not.toContain(shopKhi.id);

    // 5. Combined city + search term
    const combinedMatch = await getPublicShops({ city: "Karachi", q: breezeName });
    expect(combinedMatch.length).toBe(1);
    expect(combinedMatch[0].id).toBe(shopKhi.id);

    const combinedMismatch = await getPublicShops({ city: "Lahore", q: breezeName });
    expect(combinedMismatch.length).toBe(0);
  });

  it("retrieves individual public shop details by ID and throws 404 for nonexistent shop", async () => {
    const owner = await createUser({ name: "Public Detail Owner" });
    const shop = await createShop(owner.id, {
      name: "Detailed Workshop",
      city: "Rawalpindi",
      address: "Peshawar Road",
      phone: "+92515550000",
      workStart: "08:00",
      workEnd: "17:00",
      slotMinutes: 30,
      slotCapacity: 4,
    });
    await createService(shop.id, {
      name: "Brake Pad Replacement",
      estMinutes: 60,
      basePrice: 5000,
    });

    const publicDetail = await getPublicShopById(shop.id);
    expect(publicDetail.id).toBe(shop.id);
    expect(publicDetail.name).toBe("Detailed Workshop");
    expect(publicDetail.city).toBe("Rawalpindi");
    expect(publicDetail.workStart).toBe("08:00");
    expect(publicDetail.workEnd).toBe("17:00");
    expect(publicDetail.slotMinutes).toBe(30);
    expect(publicDetail.slotCapacity).toBe(4);
    expect(publicDetail.rating).toBe(4.8);
    expect(publicDetail.services?.length).toBe(1);
    expect(publicDetail.services?.[0].name).toBe("Brake Pad Replacement");

    // No private operational data
    expect((publicDetail as Record<string, unknown>).ownerId).toBeUndefined();

    // Nonexistent shop -> 404
    await expect(getPublicShopById("nonexistent_shop_123")).rejects.toThrow(NotFoundError);
  });
});
