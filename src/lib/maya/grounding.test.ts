import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefenReply, findUnsupportedSpecifics, groundAssistantReply } from "./grounding";

describe("factual grounding", () => {
  const corpus = "VP Nest ke liye kal subah ek client call hai.";

  it("treats an invented clock time as unsupported", () => {
    const reply = "Kal subah 10:30 baje ka client call hoga.";
    assert.ok(findUnsupportedSpecifics(reply, corpus).some((token) => /10[:.]30/.test(token)));
    const grounded = groundAssistantReply(reply, corpus, "kitne baje?");
    assert.doesNotMatch(grounded, /10[:.]30/);
    assert.match(grounded, /nahi pata|don't know|bataya nahi|not given|Bataoge|What should I use/i);
  });

  it("keeps a time the owner actually said", () => {
    const said = "Meeting 4:30 pm hai.";
    const reply = "Theek hai, 4:30 pm.";
    assert.equal(findUnsupportedSpecifics(reply, said).length, 0);
    assert.equal(groundAssistantReply(reply, said, "kitne baje?"), reply);
  });

  it("does not invent a calendar date or a fee", () => {
    const dateReply = groundAssistantReply("Party 15 March ko hai.", "Next week party hai.", "kaunsi tareekh?");
    assert.doesNotMatch(dateReply, /15 March/i);
    const feeReply = groundAssistantReply("Fees ₹5000 lagegi.", "Invoice bhej dena.", "kitna lagega?");
    assert.doesNotMatch(feeReply, /5000/);
  });

  it("leaves a calculated percent alone when no currency was invented", () => {
    const reply = "Rent is 42.86% of salary.";
    assert.equal(findUnsupportedSpecifics(reply, "rent 18000 salary 42000").length, 0);
  });

  it("asks when an appointment time was never given", () => {
    const reply = "Doctor wala appointment 11:00 am pe set hai.";
    const grounded = groundAssistantReply(reply, "Kal dopahar doctor appointment hai.", "kitne baje?");
    assert.doesNotMatch(grounded, /11[:.]00/);
    assert.match(grounded, /nahi pata|don't know|bataya nahi|Bataoge|What should I use/i);
  });

  it("keeps model unknown phrasing when it already admits not knowing without a clock", () => {
    const reply = "Nahin, maine nahi pata. Time nahi pata — bataoge?";
    const grounded = groundAssistantReply(reply, "Kal shaam ek call hai.", "kitne baje?");
    assert.match(grounded, /nahi pata/i);
    assert.doesNotMatch(grounded, /\d{1,2}[:.]\d{2}/);
  });

  it("shortens padded replies only for greetings", () => {
    const padded =
      "Hey sweetie. Aaj ka business kaam kaisa lag raha hai VP Nest par. Tumhare dil mein kaise ho. Bas ek minute ka chill.";
    const short = briefenReply(padded, "Hey baby.");
    assert.match(short, /^Hey sweetie\./);
    assert.doesNotMatch(short, /ek minute ka chill/);
    const tired = briefenReply(padded, "Maya, main aaj thak gaya hoon.");
    assert.equal(tired, padded);
  });

  it("hedges an affirming invented shared past when corpus has no support", () => {
    const reply = "Haan, kal raat Goa gaye the... par tu bhi khud ke saath kaise tha?";
    const grounded = groundAssistantReply(reply, "Owner likes elaichi chai.", "Kal raat Goa gaye the kya hum?");
    assert.doesNotMatch(grounded, /^Haan/i);
    assert.match(grounded, /nahi|don't have|verified/i);
  });
});
