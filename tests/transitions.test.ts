import { describe, it, expect } from "vitest";
import { TRANSITIONS, findTransition } from "@/lib/state/transitions";
import { BookingStatusEnum, type BookingStatus } from "@/lib/contracts/common";

describe("State Machine Transitions (transitions.ts)", () => {
  it("contains no duplicate (from, to) transition pairs", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const transition of TRANSITIONS) {
      const key = `${transition.from} -> ${transition.to}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it("ensures every status in BookingStatus is reachable from the initial state PENDING", () => {
    const allStatuses = BookingStatusEnum.options;
    const initialStatus: BookingStatus = "PENDING";

    // Build directed adjacency graph from transitions
    const adjacencyList = new Map<BookingStatus, Set<BookingStatus>>();
    for (const status of allStatuses) {
      adjacencyList.set(status, new Set<BookingStatus>());
    }

    for (const transition of TRANSITIONS) {
      adjacencyList.get(transition.from)?.add(transition.to);
    }

    // Traverse BFS from PENDING
    const reachable = new Set<BookingStatus>([initialStatus]);
    const queue: BookingStatus[] = [initialStatus];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current) ?? new Set();

      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const unreachable = allStatuses.filter((s) => !reachable.has(s));
    expect(unreachable).toEqual([]);
    expect(reachable.size).toBe(allStatuses.length);
  });

  it("ensures terminal statuses (COMPLETED, CANCELLED) have no outbound transitions", () => {
    const outboundFromCompleted = TRANSITIONS.filter((t) => t.from === "COMPLETED");
    const outboundFromCancelled = TRANSITIONS.filter((t) => t.from === "CANCELLED");

    expect(outboundFromCompleted).toHaveLength(0);
    expect(outboundFromCancelled).toHaveLength(0);
  });

  it("correctly finds transitions via findTransition helper", () => {
    const pendingToConfirmed = findTransition("PENDING", "CONFIRMED");
    expect(pendingToConfirmed).toBeDefined();
    expect(pendingToConfirmed?.row).toBe("1");
    expect(pendingToConfirmed?.roles).toContain("SERVICE_ADVISOR");

    const invalidTransition = findTransition("PENDING", "COMPLETED");
    expect(invalidTransition).toBeUndefined();
  });
});
