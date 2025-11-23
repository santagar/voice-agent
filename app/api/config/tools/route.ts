import { NextResponse } from "next/server";
import toolsConfig from "@/config/tools.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tools = Array.isArray(toolsConfig.tools)
      ? toolsConfig.tools
      : [];
    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error("Failed to load tools.json:", err);
    return NextResponse.json(
      { error: "Failed to load tools" },
      { status: 500 }
    );
  }
}

