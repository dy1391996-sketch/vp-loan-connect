import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin,requestIpHash } from "@/lib/security/request";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){assertSameOrigin(request);const{admin}=await requireAdmin(["SUPER_ADMIN","ADMIN"]);const{id}=await params;const report=await prisma.report.findUnique({where:{id},include:{order:true}});if(!report||report.order.status!=="PAID")return NextResponse.json({error:"Paid report not found."},{status:404});await prisma.$transaction([prisma.report.update({where:{id},data:{status:"QUEUED",failureReason:null,generatedAt:null,deliveredAt:null}}),prisma.auditLog.create({data:{adminId:admin.id,action:"REPORT_REGENERATE",entityType:"Report",entityId:id,ipHash:requestIpHash(request)}})]);return NextResponse.json({queued:true});}
