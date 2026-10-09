import type { Role } from "@/lib/contracts/common";
import type { AuthUser, MembershipInfo } from "@/lib/auth/types";
import { ForbiddenError } from "@/lib/errors";

export function requireMembership(
  user: AuthUser,
  shopId: string,
  allowedRoles?: readonly Role[]
): MembershipInfo {
  const membership = user.memberships.find(
    (m) => m.shopId === shopId && m.isActive
  );

  if (!membership) {
    throw new ForbiddenError("Not authorized to access this shop");
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole =
      allowedRoles.includes(membership.role) ||
      (membership.role === "OWNER" && allowedRoles.includes("OWNER"));

    if (!hasRole) {
      throw new ForbiddenError(
        `Role ${membership.role} is not permitted for this action. Required: ${allowedRoles.join(", ")}`
      );
    }
  }

  return membership;
}
