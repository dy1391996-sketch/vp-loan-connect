import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { jsonError } from "@/lib/auth/api";
import { safeJson } from "@/lib/utils";

export type RouteContext = { params: Promise<{ id: string }> };

export async function parseJsonBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await request.json().catch(() => null);
  return schema.parse(body);
}

export function routeError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed.", issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) },
      { status: 422 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return jsonError("Record not found.", 404);
    if (error.code === "P2002") return jsonError("A record with this unique value already exists.", 409);
  }

  return jsonError(error instanceof Error ? error.message : "Something went wrong.", 400);
}

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(safeJson(data), init);
}

export function searchParams(request: Request) {
  return new URL(request.url).searchParams;
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}
