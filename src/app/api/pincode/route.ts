import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostalResponse = Array<{
  Status?: string;
  PostOffice?: Array<{ District?: string; State?: string; Name?: string }>;
}>;

export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get("pin")?.trim() ?? "";
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a valid 6-digit PIN code." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "PIN lookup unavailable." }, { status: 502 });
    }
    const data = (await response.json()) as PostalResponse;
    const office = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : null;
    if (!office) {
      return NextResponse.json({ error: "PIN not found." }, { status: 404 });
    }
    return NextResponse.json({
      pin,
      city: office.District || office.Name || "",
      state: office.State || "",
    });
  } catch {
    return NextResponse.json({ error: "PIN lookup failed." }, { status: 502 });
  }
}
