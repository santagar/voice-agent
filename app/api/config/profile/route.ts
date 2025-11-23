import { NextResponse } from "next/server";
import profile from "@/config/profile.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("Failed to load profile.json:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

