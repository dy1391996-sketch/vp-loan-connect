import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spokenForm } from "./speech-text";

describe("spokenForm", () => {
  it("strips emoji and markdown without changing the words", () => {
    assert.equal(spokenForm("Hey **love** 😊 rest karo"), "Hey love rest karo");
  });

  it("returns empty when nothing speakable remains", () => {
    assert.equal(spokenForm("😊"), "");
  });
});
