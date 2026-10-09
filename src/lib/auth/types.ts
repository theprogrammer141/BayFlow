import { Role } from "@/lib/contracts/common";

export interface MembershipInfo {
  id: string;
  shopId: string;
  role: Role;
  isActive: boolean;
  shop?: {
    id: string;
    name: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isCustomer: boolean;
  memberships: MembershipInfo[];
}

export const AUTH_COOKIE_NAME = "bayflow_token";
