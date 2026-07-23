import type { AdminRole } from "@prisma/client";

export function canExportLeads(role: AdminRole) { return role === "SUPER_ADMIN" || role === "ADMIN"; }
export function canManageSettings(role: AdminRole) { return role === "SUPER_ADMIN" || role === "ADMIN"; }
export function canViewOperations(role: AdminRole) { return ["SUPER_ADMIN", "ADMIN", "ANALYST", "SUPPORT"].includes(role); }
