"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
export function RegenerateReportButton({id}:{id:string}){const[status,setStatus]=useState("");return <button onClick={async()=>{setStatus("Resetting…");const r=await fetch(`/api/admin/reports/${id}/regenerate`,{method:"POST"});setStatus(r.ok?"Queued":"Failed");}} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-bold"><RefreshCw size={13}/>{status||"Regenerate"}</button>}
