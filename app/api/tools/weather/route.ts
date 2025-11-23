import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = (searchParams.get("city") || "").trim();

    if (!city) {
      return NextResponse.json(
        { error: "Missing required query parameter 'city'." },
        { status: 400 }
      );
    }

    // Demo / mock response. In a real implementation you would call an
    // external weather API here. The tool is designed to demonstrate
    // how business tools are wired, not to provide real forecasts.
    const normalizedCity =
      city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();

    const mockConditions = [
      "clear sky",
      "partly cloudy",
      "light rain",
      "overcast",
      "breezy with mild temperatures",
    ];
    const condition =
      mockConditions[Math.floor(Math.random() * mockConditions.length)];

    return NextResponse.json({
      city: normalizedCity,
      condition,
      temperature_c: 22,
      temperature_f: 72,
      humidity_percent: 55,
      wind_kph: 12,
      source: "demo-mock",
      summary: `In ${normalizedCity} right now the weather is ${condition}, around 22ºC, with a light breeze.`,
    });
  } catch (err: any) {
    console.error("Error in /api/tools/weather:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to fetch weather information." },
      { status: 500 }
    );
  }
}

