import type { Prisma } from "@/generated/prisma/client";
import type {
  Booking,
  BookingService,
  Estimate,
  EstimateItem,
  Allocation,
} from "@/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/types";

export interface EffectContext {
  booking: Booking & {
    services?: BookingService[];
    estimate?: (Estimate & { items: EstimateItem[] }) | null;
    allocations?: Allocation[];
  };
  actor: AuthUser;
  note?: string;
  payload?: Record<string, unknown>;
}

export type EffectFn = (
  tx: Prisma.TransactionClient,
  ctx: EffectContext
) => Promise<void> | void;

const effectsRegistry = new Map<string, EffectFn>();

export function registerEffect(key: string, fn: EffectFn): void {
  effectsRegistry.set(key, fn);
}

export function getEffect(key: string): EffectFn | undefined {
  return effectsRegistry.get(key);
}
