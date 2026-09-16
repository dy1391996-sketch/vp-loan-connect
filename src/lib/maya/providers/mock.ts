import type { CompiledContext } from "../types";
import type { MayaLLMProvider } from "./types";

const SUPPORT_BANNED = [
  "how can i help",
  "how may i assist",
  "thank you for reaching out",
  "i'd be happy to assist",
  "is there anything else",
  "as an ai language model",
  "nice to meet you",
  "tell me about yourself",
  "मेरी memory",
  "मुझे याद है",
  "database",
];

export function createMockMayaProvider(): MayaLLMProvider {
  return {
    id: "mock",
    async generate({ context, messages }) {
      const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
      const text = context.ownerAuthorized ? ownerReply(context, lastUser) : publicReply(lastUser);
      return { text, provider: "mock", model: "maya-mock-1" };
    },
  };
}

function publicReply(lastUser: string) {
  if (/maya|girlfriend|yaad|memory|project|payment/i.test(lastUser)) {
    return "Hey — this isn't a private chat. I can't talk about anyone's personal stuff here.";
  }
  return "Hey, this channel isn't a private conversation. Keep it general.";
}

function ownerReply(context: CompiledContext, lastUser: string) {
  if (isBadIdea(lastUser)) {
    return "No, मुझे ये idea सही नहीं लग रहा. Don't do that.";
  }

  const uncertain = context.memories.filter((memory) => memory.confidence === "UNCERTAIN" || memory.status === "uncertain");
  if (uncertain.length && /meeting|kab|when|hai kya/i.test(lastUser)) {
    return hedge(uncertain[0].content);
  }

  const projectHit = context.projects.find((project) => mentions(lastUser, project.name) || /project|business/i.test(lastUser));
  if (projectHit && /kya|status|hua|update/i.test(lastUser)) {
    return naturalProject(projectHit.name, projectHit.latestUpdate ?? projectHit.description ?? projectHit.status);
  }

  const loop = context.openLoops[0];
  if (loop && /payment|issue|pending|hua/i.test(lastUser)) {
    return naturalLoop(loop.description);
  }

  const known = context.memories.find((memory) => memory.confidence === "KNOWN" && memory.type !== "CONVERSATION_SUMMARY");
  if (known && relevant(lastUser, known.content)) {
    if (normalizeLoose(known.content) === normalizeLoose(lastUser)) {
      return mix(lastUser, context.relationshipState.affectionContext);
    }
    return weave(known.content, lastUser, context.relationshipState.affectionContext);
  }

  if (!lastUser.trim()) return "Hmm?";
  const playful = context.relationshipState.playfulness > 0.55;
  if (lastUser.length < 18) return playful ? "Haan bol." : "Haan.";
  if (lastUser.length > 180) {
    return `${context.relationshipState.affectionContext === "comforting" ? "Hey." : "Okay."} Main suna. There's a lot in what you said. Jab ready हो then we go one step at a time.`;
  }
  return mix(lastUser, context.relationshipState.affectionContext);
}

function isBadIdea(text: string) {
  return /pan .{0,40}(instagram|random)|otp .{0,20}(de do|share)|password (de|share)|ghost that client/i.test(text);
}

function hedge(content: string) {
  if (/tuesday/i.test(content)) return "ये वही वाला था ना... Tuesday? एक बार confirm कर दो, मुझे पूरा sure नहीं।";
  return "मुझे थोड़ा-सा याद आ रहा है, but I don't want to lock it in. Confirm kar do?";
}

function naturalProject(name: string, update: string) {
  return `${name} वाला ${trimFact(update)} — that's the latest I have.`;
}

function naturalLoop(description: string) {
  if (/payment/i.test(description)) return "उसका payment वाला issue अभी solve नहीं हुआ?";
  return `${trimFact(description)} — that's still open, right?`;
}

function weave(fact: string, lastUser: string, affection: string) {
  const body = trimFact(fact);
  if (/business/i.test(fact) && /kya|kaisa|hua|chal/i.test(lastUser)) {
    return affection === "proud"
      ? "Business वाला start — that's still the thing on the table. How's it moving?"
      : "Business वाला start still stands. Kaisa chal raha hai?";
  }
  return `${body.replace(/^i |^मैं /i, "").replace(/\.$/, "")}.`;
}

function mix(lastUser: string, affection: string) {
  if (affection === "comforting") return "Aaja. I'm here. Jo heavy hai, woh yahin rakh.";
  if (affection === "teasing") return "Acha, dramatic ho rahe ho thoda. Bol, actually kya hua.";
  if (affection === "serious") return "Okay. Let's keep this clean and practical.";
  return /[\u0900-\u097F]/.test(lastUser) ? "Haan, main suna. Bol." : "I'm with you. Go on.";
}

function relevant(query: string, fact: string) {
  const q = query.toLowerCase();
  const f = fact.toLowerCase();
  return f.split(/\s+/).filter((token) => token.length > 3).some((token) => q.includes(token)) || /business|project|payment|client/.test(q);
}

function mentions(text: string, name: string) {
  return text.toLowerCase().includes(name.toLowerCase());
}

function trimFact(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeLoose(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function violatesPersonality(text: string) {
  const lower = text.toLowerCase();
  return SUPPORT_BANNED.some((phrase) => lower.includes(phrase));
}
