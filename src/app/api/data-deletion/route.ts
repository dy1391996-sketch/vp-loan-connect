import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, sanitizeText } from "@/lib/security/request";
import { verifyAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";

const schema=z.object({verificationToken:z.string().min(20),mobile:z.string().regex(/^[6-9]\d{9}$/),reason:z.string().max(1000).optional()});
export async function POST(request:NextRequest){try{assertSameOrigin(request);const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid deletion request."},{status:400});const mobile=normalizeIndianMobile(parsed.data.mobile);const token=await verifyAccessToken(parsed.data.verificationToken,"otp_verified");if(token.sub!==mobile||typeof token.leadId!=="string")return NextResponse.json({error:"Mobile verification mismatch."},{status:403});const result=await prisma.$transaction(async(tx)=>{const item=await tx.dataDeletionRequest.create({data:{leadId:token.leadId as string,mobile,reason:parsed.data.reason?sanitizeText(parsed.data.reason):null,status:"REQUESTED",verifiedAt:new Date()}});await tx.lead.update({where:{id:token.leadId as string},data:{deletionRequestedAt:new Date()}});return item;});return NextResponse.json({requestId:result.id,status:result.status});}catch(error){console.error("deletion_request_failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"Unable to record deletion request."},{status:500});}}
