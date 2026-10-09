import { describe, it, expect } from "vitest";
import { createUser, createShop, createMembership, createPart, createBooking } from "./factories";
import {
  getOwnerShops,
  createShop as createShopAction,
  updateShop,
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  getShopServices,
  createShopService,
  updateShopService,
  getShopOverview,
} from "@/lib/services/shops";
import { login } from "@/lib/services/auth";
import { ForbiddenError, NotFoundError, ConflictError, UnauthenticatedError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";

function toAuthUser(user: { id: string; email: string; name: string; phone?: string | null; isCustomer: boolean }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    isCustomer: user.isCustomer,
    memberships: [],
  };
}

describe("Owner Service & API Unit/Integration Tests", () => {
  it("allows owner to create a second shop with independent scope and lists only their own shops", async () => {
    const owner1 = await createUser({ name: "Owner One" });
    const authOwner1 = toAuthUser(owner1);

    const owner2 = await createUser({ name: "Owner Two" });
    const authOwner2 = toAuthUser(owner2);

    // Owner 1 creates shop 1
    const shop1 = await createShopAction(authOwner1, {
      name: "Owner 1 Motors",
      address: "123 Main St",
      city: "Lahore",
      phone: "+923001112233",
      logoUrl: null,
      workStart: "09:00",
      workEnd: "18:00",
      slotMinutes: 60,
      slotCapacity: 2,
    });
    expect(shop1.id).toBeDefined();
    expect(shop1.ownerId).toBe(owner1.id);

    // Owner 1 creates a second shop
    const shop2 = await createShopAction(authOwner1, {
      name: "Owner 1 Express",
      address: "456 Defense Rd",
      city: "Lahore",
      phone: "+923002223344",
      logoUrl: null,
      workStart: "08:00",
      workEnd: "20:00",
      slotMinutes: 30,
      slotCapacity: 4,
    });
    expect(shop2.id).toBeDefined();
    expect(shop2.ownerId).toBe(owner1.id);

    // Owner 2 creates their own shop
    const shop3 = await createShopAction(authOwner2, {
      name: "Owner 2 Autocare",
      address: "789 Clifton",
      city: "Karachi",
      phone: "+923003334455",
      logoUrl: null,
      workStart: "10:00",
      workEnd: "19:00",
      slotMinutes: 60,
      slotCapacity: 3,
    });

    // List shops for Owner 1 -> should return exactly 2 shops
    const owner1Shops = await getOwnerShops(authOwner1);
    expect(owner1Shops.length).toBe(2);
    expect(owner1Shops.map((s) => s.id)).toContain(shop1.id);
    expect(owner1Shops.map((s) => s.id)).toContain(shop2.id);
    expect(owner1Shops.map((s) => s.id)).not.toContain(shop3.id);

    // List shops for Owner 2 -> should return exactly 1 shop
    const owner2Shops = await getOwnerShops(authOwner2);
    expect(owner2Shops.length).toBe(1);
    expect(owner2Shops[0].id).toBe(shop3.id);
  });

  it("prevents an owner from accessing or updating another owner's shop", async () => {
    const owner1 = await createUser({ name: "Owner Alpha" });
    const authOwner1 = toAuthUser(owner1);

    const owner2 = await createUser({ name: "Owner Beta" });
    const authOwner2 = toAuthUser(owner2);

    const shop1 = await createShop(owner1.id, { name: "Alpha Workshop" });

    // Owner 1 can update their shop
    const updated = await updateShop(authOwner1, shop1.id, {
      name: "Alpha Premium Workshop",
    });
    expect(updated.name).toBe("Alpha Premium Workshop");

    // Owner 2 cannot update Owner 1's shop -> 403 Forbidden
    await expect(
      updateShop(authOwner2, shop1.id, {
        name: "Hacked Workshop",
      })
    ).rejects.toThrow(ForbiddenError);

    // Owner 2 cannot view Owner 1's team -> 403 Forbidden
    await expect(getTeamMembers(authOwner2, shop1.id)).rejects.toThrow(ForbiddenError);

    // Nonexistent shop -> 404 NotFound
    await expect(
      updateShop(authOwner1, "nonexistent_shop_id", { name: "New Name" })
    ).rejects.toThrow(NotFoundError);
  });

  it("manages team members and enforces deactivation login blocking", async () => {
    const owner = await createUser({ name: "Shop Boss" });
    const authOwner = toAuthUser(owner);
    const shop = await createShop(owner.id, { name: "Boss Garage" });
    await createMembership(owner.id, shop.id, "OWNER");

    const staffEmail = `tech_${Date.now()}@test.io`;

    // 1. Add team member
    const techMember = await addTeamMember(authOwner, shop.id, {
      name: "Tariq Technician",
      email: staffEmail,
      phone: "+923004445566",
      role: "TECHNICIAN",
      password: "techpassword123",
    });

    expect(techMember.id).toBeDefined();
    expect(techMember.role).toBe("TECHNICIAN");
    expect(techMember.isActive).toBe(true);
    expect(techMember.user.email).toBe(staffEmail);

    // Verify duplicate team member in same shop rejected
    await expect(
      addTeamMember(authOwner, shop.id, {
        name: "Duplicate Tech",
        email: staffEmail,
        role: "TECHNICIAN",
        password: "techpassword123",
      })
    ).rejects.toThrow(ConflictError);

    // 2. Staff can log in while active
    const loginSuccess = await login({
      email: staffEmail,
      password: "techpassword123",
    });
    expect(loginSuccess.user.email).toBe(staffEmail);
    expect(loginSuccess.user.memberships.length).toBe(1);
    expect(loginSuccess.user.memberships[0].role).toBe("TECHNICIAN");

    // 3. Update team member role
    const roleUpdated = await updateTeamMember(authOwner, shop.id, techMember.id, {
      role: "SERVICE_ADVISOR",
    });
    expect(roleUpdated.role).toBe("SERVICE_ADVISOR");

    // 4. Deactivate team member
    const deactivated = await updateTeamMember(authOwner, shop.id, techMember.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);

    // 5. Deactivated staff cannot authenticate!
    await expect(
      login({
        email: staffEmail,
        password: "techpassword123",
      })
    ).rejects.toThrow(UnauthenticatedError);
  });

  it("manages services and enforces unique service names per shop", async () => {
    const owner = await createUser({ name: "Service Owner" });
    const authOwner = toAuthUser(owner);
    const shop = await createShop(owner.id, { name: "Service Shop" });

    // 1. Create service
    const srv1 = await createShopService(authOwner, shop.id, {
      name: "Oil Change",
      description: "Full synthetic oil and filter change",
      estMinutes: 45,
      basePrice: 6500,
    });
    expect(srv1.id).toBeDefined();
    expect(srv1.name).toBe("Oil Change");
    expect(srv1.basePrice).toBe(6500);

    // 2. Create second service
    const srv2 = await createShopService(authOwner, shop.id, {
      name: "Brake Inspection",
      estMinutes: 30,
      basePrice: 2500,
    });
    expect(srv2.id).toBeDefined();

    // 3. Reject duplicate service name in same shop
    await expect(
      createShopService(authOwner, shop.id, {
        name: "Oil Change",
        estMinutes: 60,
      })
    ).rejects.toThrow(ConflictError);

    // 4. List services
    const services = await getShopServices(authOwner, shop.id);
    expect(services.length).toBe(2);
    expect(services.map((s) => s.name)).toEqual(["Brake Inspection", "Oil Change"]);

    // 5. Update service
    const updated = await updateShopService(authOwner, shop.id, srv1.id, {
      basePrice: 7000,
      estMinutes: 50,
    });
    expect(updated.basePrice).toBe(7000);
    expect(updated.estMinutes).toBe(50);
  });

  it("retrieves shop overview with grouped booking counts, team count, and inventory summary", async () => {
    const owner = await createUser({ name: "Overview Owner" });
    const authOwner = toAuthUser(owner);
    const customer = await createUser({ name: "Customer X", isCustomer: true });
    const shop = await createShop(owner.id, { name: "Overview Garage" });

    // Team members
    await createMembership(owner.id, shop.id, "OWNER");
    const tech = await createUser({ name: "Tech Y" });
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    // Bookings in different statuses
    await createBooking(shop.id, customer.id, { status: "PENDING" });
    await createBooking(shop.id, customer.id, { status: "PENDING" });
    await createBooking(shop.id, customer.id, { status: "IN_REPAIR" });

    // Parts in inventory
    await createPart(shop.id, { quantity: 10, reorderLevel: 2 });
    await createPart(shop.id, { quantity: 1, reorderLevel: 5 }); // low stock

    const overview = await getShopOverview(authOwner, shop.id);

    expect(overview.shop.id).toBe(shop.id);
    expect(overview.teamCount).toBe(2);
    expect(overview.countsByStatus.PENDING).toBe(2);
    expect(overview.countsByStatus.IN_REPAIR).toBe(1);
    expect(overview.countsByStatus.COMPLETED).toBe(0);
    expect(overview.inventorySummary.totalParts).toBe(2);
    expect(overview.inventorySummary.lowStockCount).toBe(1);
  });
});
