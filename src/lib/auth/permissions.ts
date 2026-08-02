import type { StaffRole } from "@prisma/client";

const ALL: StaffRole[] = ["OWNER", "BOOKING_MANAGER", "SOCIAL_MEDIA_MANAGER", "HOUSEKEEPING_MANAGER", "READ_ONLY"];

export type Permission =
  | "dashboard:view"
  | "inbox:manage"
  | "leads:manage"
  | "customers:view"
  | "studios:manage"
  | "pricing:manage"
  | "bookings:manage"
  | "payments:manage"
  | "content:manage"
  | "cleaning:manage"
  | "analytics:view"
  | "team:manage"
  | "settings:manage"
  | "audit:view"
  | "integrations:manage";

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  OWNER: [
    "dashboard:view",
    "inbox:manage",
    "leads:manage",
    "customers:view",
    "studios:manage",
    "pricing:manage",
    "bookings:manage",
    "payments:manage",
    "content:manage",
    "cleaning:manage",
    "analytics:view",
    "team:manage",
    "settings:manage",
    "audit:view",
    "integrations:manage",
  ],
  BOOKING_MANAGER: [
    "dashboard:view",
    "inbox:manage",
    "leads:manage",
    "customers:view",
    "studios:manage",
    "bookings:manage",
    "payments:manage",
    "cleaning:manage",
    "analytics:view",
  ],
  SOCIAL_MEDIA_MANAGER: ["dashboard:view", "content:manage", "customers:view", "analytics:view", "leads:manage"],
  HOUSEKEEPING_MANAGER: ["dashboard:view", "cleaning:manage", "studios:manage"],
  READ_ONLY: ["dashboard:view", "customers:view"],
};

export function can(role: StaffRole, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(role: StaffRole, permission: Permission) {
  if (!can(role, permission)) {
    const error = new Error("Forbidden");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
}

export function rolesForPermission(permission: Permission): StaffRole[] {
  return ALL.filter((role) => can(role, permission));
}
