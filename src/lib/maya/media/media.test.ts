import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { MediaStore, digest } from "./store";
import { createMedia, reviewMedia, masterReference, resolveRequest, compilePrompt } from "./service";
import { requestSchema, type MediaProvider } from "./types";
import { isMediaRequest } from "./chat";
const goodQC = { identity: true, anatomy: true, scene: true, quality: true, start: false, middle: false, end: false, note: "Test fixture only; not real identity QC" };
async function fixture() {
  const project = mkdtempSync(join(tmpdir(), "maya-media-test-")); const dir = join(project, "config/maya/visual"); mkdirSync(dir, { recursive: true });
  const bytes = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#ccaaaa" } }).png().toBuffer();
  writeFileSync(join(dir,"MASTER_MAYA_REFERENCE.png"),bytes); writeFileSync(join(dir,"master-integrity.json"),JSON.stringify({sha256:digest(bytes)}));
  const store = new MediaStore(join(project,"media"));
  const generate = async () => ({ bytes, mime: "image/png" as const, model: "test-fixture-not-a-real-generation" });
  const provider: MediaProvider = { id: "test-only", generatePhoto: generate, generateVideo: generate, imageToVideo: generate };
  return { project, store, provider, bytes, cleanup: () => rmSync(project, { recursive: true, force: true }) };
}
test("durable owner-private photo workflow, explicit QC, reference promotion and immutable Master", async () => {
  const f=await fixture(); try {
    const before = masterReference(f.project).hash;
    const r=await createMedia("owner", {kind:"photo",scene:"Balcony at night",outfit:"blue dress",pose:"standing"},f);
    assert.equal(r.status,"READY_FOR_REVIEW"); assert.equal(r.useAsReference,false);
    assert.throws(()=>reviewMedia("owner",r.id,"accept",undefined,undefined,f.store),/VISUAL_QC_REQUIRED/);
    assert.throws(()=>reviewMedia("other",r.id,"accept",goodQC,undefined,f.store),/NOT_FOUND/);
    reviewMedia("owner",r.id,"accept",goodQC,undefined,f.store);
    const approved=reviewMedia("owner",r.id,"reference",undefined,undefined,f.store); assert.equal(approved.useAsReference,true);
    const reload=new MediaStore(f.store.root); assert.equal(reload.get("owner",r.id).status,"ACCEPTED");
    assert.equal(masterReference(f.project).hash,before);
    const next=resolveRequest("owner",{kind:"photo",scene:"New park",continuityId:r.id,continuity:["outfit"]},f.store); assert.equal(next.outfit,"blue dress"); assert.equal(next.scene,"New park");
    const video=resolveRequest("owner",{kind:"video",scene:"wrong new scene",sourcePhotoId:r.id},f.store); assert.equal(video.scene,"Balcony at night"); assert.equal(video.pose,"standing");
    assert.throws(()=>requestSchema.parse({kind:"photo",scene:"test",master:"replace"}));
    reviewMedia("owner",r.id,"reject",undefined,"face wrong",f.store);
    assert.throws(()=>resolveRequest("owner",{kind:"video",scene:"animate",sourcePhotoId:r.id},f.store),/APPROVED_SOURCE/);
    assert.match(compilePrompt(next,f.store.list("owner")),/face wrong/);
  } finally {f.cleanup();}
});
test("provider failures and invalid bytes cannot be accepted; missing or modified Master blocks",async()=>{
 const f=await fixture();try{
  f.provider.generatePhoto=async()=>{throw new Error("secret credential must not escape");};
  const failed=await createMedia("owner",{kind:"photo",scene:"Outdoor photo"},f);assert.equal(failed.status,"FAILED");assert.ok(!failed.error?.includes("secret"));
  assert.throws(()=>reviewMedia("owner",failed.id,"accept",goodQC,undefined,f.store),/VISUAL_QC/);
  f.provider.generatePhoto=async()=>({bytes:Buffer.from("bad"),mime:"image/png",model:"bad"});
  const bad=await createMedia("owner",{kind:"photo",scene:"Indoor photo"},f);assert.equal(bad.status,"QC_FAILED");
  writeFileSync(join(f.project,"config/maya/visual/MASTER_MAYA_REFERENCE.png"),"changed");
  await assert.rejects(createMedia("owner",{kind:"photo",scene:"Test scene"},f),/MASTER_INTEGRITY/);
  rmSync(join(f.project,"config/maya/visual/MASTER_MAYA_REFERENCE.png"));
  await assert.rejects(createMedia("owner",{kind:"photo",scene:"Test scene"},f),/MASTER_MAYA_MISSING/);
 }finally{f.cleanup();}
});
test("video requires exact approved photo bytes and temporal checks",async()=>{
 const f=await fixture();try{
  await assert.rejects(createMedia("owner",{kind:"video",scene:"New video"},f),/APPROVED_SOURCE/);
  const r=await createMedia("owner",{kind:"photo",scene:"A room"},f);
  await assert.rejects(createMedia("owner",{kind:"video",scene:"Animate",sourcePhotoId:r.id},f),/APPROVED_SOURCE/);
  reviewMedia("owner",r.id,"accept",goodQC,undefined,f.store);
  let sourceMatches=false;
  f.provider.imageToVideo=async input=>{sourceMatches=input.source.equals(f.bytes);throw new Error("unavailable");};
  const v=await createMedia("owner",{kind:"video",scene:"Animate",sourcePhotoId:r.id},f);assert.equal(sourceMatches,true);assert.equal(v.request.sourcePhotoId,r.id);
  const ready={...v,status:"READY_FOR_REVIEW" as const,file:r.file,sha256:r.sha256};f.store.save(ready);
  assert.throws(()=>reviewMedia("owner",v.id,"accept",goodQC,undefined,f.store),/VISUAL_QC/);
  reviewMedia("owner",v.id,"accept",{...goodQC,start:true,middle:true,end:true},undefined,f.store);
  assert.throws(()=>reviewMedia("owner",v.id,"reference",undefined,undefined,f.store),/ONLY_ACCEPTED_PHOTO/);
  writeFileSync(f.store.path("owner",r.file!),"tampered");assert.throws(()=>f.store.bytes(r),/INTEGRITY/);
 }finally{f.cleanup();}
});
test("path isolation, exact continuity and narrow chat routing",()=>{
 const store=new MediaStore();assert.throws(()=>store.path("owner","../master.png"),/INVALID_MEDIA_PATH/);
 assert.equal(isMediaRequest("Maya gym wali photo banao"),true);assert.equal(isMediaRequest("is photo ko video bana do"),true);
 assert.equal(isMediaRequest("I saw a photo at the beach yesterday"),false);
 assert.throws(()=>resolveRequest("owner",{kind:"photo",scene:"same room",continuity:["scene"]}),/CONTINUITY_SOURCE_REQUIRED/);
});
