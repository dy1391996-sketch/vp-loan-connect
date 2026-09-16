import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { assertSameOrigin } from "./request";

const ORIGINAL_ENV = { ...process.env };

before(() => {
  process.env.NODE_ENV = "development";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

after(() => {
  process.env = { ...ORIGINAL_ENV };
});

function post(url: string, origin: string) {
  return new NextRequest(url, { method: "POST", headers: { origin } });
}

describe("assertSameOrigin loopback aliases", () => {
  it("accepts 127.0.0.1 origin when the app URL is localhost", () => {
    assert.doesNotThrow(() => assertSameOrigin(post("http://127.0.0.1:3000/api/maya/login", "http://127.0.0.1:3000")));
    assert.doesNotThrow(() => assertSameOrigin(post("http://localhost:3000/api/maya/login", "http://127.0.0.1:3000")));
    assert.doesNotThrow(() => assertSameOrigin(post("http://localhost:3000/api/maya/login", "http://localhost:3000")));
  });

  it("rejects a different host", () => {
    assert.throws(
      () => assertSameOrigin(post("http://localhost:3000/api/maya/login", "https://evil.example")),
      /INVALID_ORIGIN/,
    );
  });
});
