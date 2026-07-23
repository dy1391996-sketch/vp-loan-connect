import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, requestIpHash, sanitizeText } from "@/lib/security/request";

const stages=["NEW_LEAD","OTP_VERIFIED","ASSESSMENT_STARTED","ASSESSMENT_COMPLETED","FREE_RESULT_VIEWED","PAYMENT_PENDING","PAID","REPORT_PROCESSING","REPORT_DELIVERED","CONSULTATION_REQUESTED","LENDER_REFERRAL_REQUESTED","REFERRED","APPLICATION_SUBMITTED","APPROVED","REJECTED","FOLLOW_UP_LATER","OPTED_OUT"] as const;
const schema=z.object({stage:z.enum(stages),notes:z.string().max(5000),markContacted:z.boolean()});
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){assertSameOrigin(request);const{admin}=await requireAdmin(["SUPER_ADMIN","ADMIN","SUPPORT"]);const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid CRM update."},{status:400});const{id}=await params;const lead=await prisma.lead.update({where:{id},data:{stage:parsed.data.stage,notes:sanitizeText(parsed.data.notes),...(parsed.data.markContacted?{lastContactedAt:new Date()}:{})}});await prisma.auditLog.create({data:{adminId:admin.id,action:"LEAD_CRM_UPDATE",entityType:"Lead",entityId:id,metadata:{stage:parsed.data.stage,markContacted:parsed.data.markContacted},ipHash:requestIpHash(request)}});return NextResponse.json({saved:true,updatedAt:lead.updatedAt});}
