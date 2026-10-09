import { describe, it, expect } from "vitest";
import { requireMembership } from "@/lib/tenancy/membership";
import { withShopScope } from "@/lib/tenancy/scope";
import { ForbiddenError } from "@/lib/errors";
import {
  createUser,
  createShop,
  createMembership,
  createBooking,
  createPart,
} from "./factories";
import type { AuthUser } from "@/lib/auth/types";

describe("Tenancy and Membership Guard (requireMembership)", () => {
  it("allows active member with allowed role", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser();
    const mem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const authUser: AuthUser = {
      id: sa.id,
      email: sa.email,
      name: sa.name,
      phone: null,
      isCustomer: false,
      memberships: [
        {
          id: mem.id,
          shopId: shop.id,
          role: "SERVICE_ADVISOR",
          isActive: true,
        },
      ],
    };

    const resolved = requireMembership(authUser, shop.id, ["SERVICE_ADVISOR"]);
    expect(resolved.id).toBe(mem.id);
    expect(resolved.shopId).toBe(shop.id);
  });

  it("throws 403 ForbiddenError if user has no membership in target shop", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id);
    const shopB = await createShop(owner.id);
    const tech = await createUser();
    const mem = await createMembership(tech.id, shopA.id, "TECHNICIAN");

    const authUser: AuthUser = {
      id: tech.id,
      email: tech.email,
      name: tech.name,
      phone: null,
      isCustomer: false,
      memberships: [
        {
          id: mem.id,
          shopId: shopA.id,
          role: "TECHNICIAN",
          isActive: true,
        },
      ],
    };

    // Tech belongs to Shop A, attempts to access Shop B
    expect(() => requireMembership(authUser, shopB.id, ["TECHNICIAN"])).toThrow(
      ForbiddenError
    );
  });

  it("throws 403 ForbiddenError if user holds an unpermitted role in target shop", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const partsUser = await createUser();
    const mem = await createMembership(partsUser.id, shop.id, "PARTS_PERSON");

    const authUser: AuthUser = {
      id: partsUser.id,
      email: partsUser.email,
      name: partsUser.name,
      phone: null,
      isCustomer: false,
      memberships: [
        {
          id: mem.id,
          shopId: shop.id,
          role: "PARTS_PERSON",
          isActive: true,
        },
      ],
    };

    // Action requires SERVICE_ADVISOR or OWNER
    expect(() =>
      requireMembership(authUser, shop.id, ["SERVICE_ADVISOR", "OWNER"])
    ).toThrow(ForbiddenError);
  });
});

describe("Tenancy Scope (withShopScope)", () => {
  it("enforces tenant-isolated queries across different shops", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id);
    const shopB = await createShop(owner.id);

    const customerA = await createUser({ isCustomer: true });
    const customerB = await createUser({ isCustomer: true });

    // Create bookings in Shop A and Shop B
    const bookingA = await createBooking(shopA.id, customerA.id);
    const bookingB = await createBooking(shopB.id, customerB.id);

    const scopeA = withShopScope(shopA.id);
    const scopeB = withShopScope(shopB.id);

    // Shop A scope can find booking A
    const foundA = await scopeA.booking.findUnique({ where: { id: bookingA.id } });
    expect(foundA?.id).toBe(bookingA.id);

    // Shop A scope cannot find booking B (returns null)
    const crossAccessB = await scopeA.booking.findUnique({ where: { id: bookingB.id } });
    expect(crossAccessB).toBeNull();

    // Shop B scope can find booking B
    const foundB = await scopeB.booking.findUnique({ where: { id: bookingB.id } });
    expect(foundB?.id).toBe(bookingB.id);

    // Shop B scope cannot find booking A (returns null)
    const crossAccessA = await scopeB.booking.findUnique({ where: { id: bookingA.id } });
    expect(crossAccessA).toBeNull();
  });

  it("isolates inventory parts by shopId", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id);
    const shopB = await createShop(owner.id);

    const partA = await createPart(shopA.id, { sku: "PART-A-001" });
    const partB = await createPart(shopB.id, { sku: "PART-B-001" });

    const scopeA = withShopScope(shopA.id);
    const partsInShopA = await scopeA.part.findMany();

    const partIdsInA = partsInShopA.map((p: { id: string }) => p.id);
    expect(partIdsInA).toContain(partA.id);
    expect(partIdsInA).not.toContain(partB.id);
  });

  it("validates actor membership inside withShopScope when actor is supplied", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id);
    const shopB = await createShop(owner.id);

    const staffA = await createUser();
    const memA = await createMembership(staffA.id, shopA.id, "TECHNICIAN");

    const actorA: AuthUser = {
      id: staffA.id,
      email: staffA.email,
      name: staffA.name,
      phone: null,
      isCustomer: false,
      memberships: [
        {
          id: memA.id,
          shopId: shopA.id,
          role: "TECHNICIAN",
          isActive: true,
        },
      ],
    };

    // Valid actor for Shop A
    const scope = withShopScope(shopA.id, actorA, ["TECHNICIAN"]);
    expect(scope.actorMembership?.id).toBe(memA.id);

    // Invalid actor for Shop B: throws 403 ForbiddenError
    expect(() => withShopScope(shopB.id, actorA, ["TECHNICIAN"])).toThrow(
      ForbiddenError
    );
  });
});
