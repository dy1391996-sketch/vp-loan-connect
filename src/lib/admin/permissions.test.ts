import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canExportLeads, canManageSettings, canViewOperations } from "./permissions";

describe("admin authorization", () => {
  it("restricts sensitive export and settings mutations", () => { assert.equal(canExportLeads("SUPER_ADMIN"), true); assert.equal(canExportLeads("ADMIN"), true); assert.equal(canExportLeads("ANALYST"), false); assert.equal(canExportLeads("SUPPORT"), false); assert.equal(canManageSettings("SUPPORT"), false); });
  it("allows active operational roles to view the dashboard", () => { assert.equal(canViewOperations("ANALYST"), true); assert.equal(canViewOperations("SUPPORT"), true); });
});
