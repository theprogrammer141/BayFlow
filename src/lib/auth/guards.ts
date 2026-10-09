import { Role } from "@/lib/contracts/common";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import type { AuthUser, MembershipInfo } from "./types";

export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new UnauthenticatedError("Authentication required");
  }
  return user;
}

export function requireRole(
  user: AuthUser,
  shopId: string,
  allowedRoles: Role[]
): MembershipInfo {
  const membership = user.memberships.find(
    (m) => m.shopId === shopId && m.isActive
  );

  if (!membership) {
    throw new ForbiddenError("Not a member of this shop");
  }

  // Check if role is directly in allowed roles or user is shop OWNER
  const hasAllowedRole =
    allowedRoles.includes(membership.role) ||
    (membership.role === "OWNER" && allowedRoles.includes("OWNER"));

  if (!hasAllowedRole) {
    throw new ForbiddenError(
      `Role ${membership.role} is not permitted for this action. Allowed: ${allowedRoles.join(", ")}`
    );
  }

  return membership;
}
