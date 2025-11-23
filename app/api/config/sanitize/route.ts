import { NextResponse } from "next/server";
import sanitize from "@/config/sanitize.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ sanitize });
  } catch (err: any) {
    console.error("Failed to load sanitize.json:", err);
    return NextResponse.json(
      { error: "Failed to load sanitize rules" },
      { status: 500 }
    );
  }
}

