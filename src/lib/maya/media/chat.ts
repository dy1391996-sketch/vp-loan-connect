import { createMedia, defaultStore } from "./service";
import { seedReferences } from "./references";
export function isMediaRequest(text: string) {
  return /\b(photo|image|picture|video|tasveer)\b/i.test(text) && /\b(banao|bana\s+do|bhejo|dikhao|generate|create|make|send|turn|animate)\b/i.test(text);
}
export async function handleMediaChat(owner: string, text: string) {
  try {
    await seedReferences(owner);
    const kind = /\b(video|animate)\b/i.test(text) ? "video" : "photo";
    const history = defaultStore.list(owner).filter(r => r.status === "ACCEPTED" && r.request.kind === "photo" && r.provenance === "VISUAL_GENERATION");
    const explicit = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
    const needsContinuity = /\b(same|previous|last|continue|is photo|this photo)\b/i.test(text);
    const source = explicit || (needsContinuity ? history[0]?.id : undefined);
    if ((kind === "video" || needsContinuity) && !source) return "Choose an accepted source photo in Media (/maya/media), then use Photo → video or continue that moment. I haven't generated anything yet.";
    const mode = /gym|fitness|workout/i.test(text) ? "fitness" : /dress|outfit|fashion/i.test(text) ? "fashion" : /café|cafe|outdoor|street|park/i.test(text) ? "lifestyle" : "casual";
    const record = await createMedia(owner, { kind, mode, scene: text, sourcePhotoId: kind === "video" ? source : undefined, continuityId: needsContinuity ? source : undefined, continuity: /same (dress|outfit)/i.test(text) ? ["outfit"] : /same (room|scene)/i.test(text) ? ["scene"] : [], referenceIds: [] });
    if (record.status === "READY_FOR_REVIEW") return `Your ${kind} is ready for visual review in Media (/maya/media). It is a synthetic scene, not a real-life event. Media ID: ${record.id}. It is not accepted yet.`;
    return `I couldn't generate that ${kind}. ${record.error || "The output failed quality checks."} The attempt is saved in Media (/maya/media); no successful image or video is being claimed.`;
  } catch { return "I couldn't start that visual request. The Master/source reference needs attention; check Media (/maya/media). No photo or video was generated."; }
}
