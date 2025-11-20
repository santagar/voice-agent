import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (
    !body ||
    typeof body.product_id !== "string" ||
    typeof body.start_date !== "string" ||
    typeof body.end_date !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Body must include product_id, start_date, end_date (all strings).",
      },
      { status: 400 }
    );
  }

  const { product_id, start_date, end_date } = body;

  return NextResponse.json({
    product_id,
    start_date,
    end_date,
    timezone: "Europe/Madrid",
    available_slots: [
      { date: start_date, seats: Math.floor(Math.random() * 10) + 5 },
      { date: end_date, seats: Math.floor(Math.random() * 10) + 5 },
    ],
    currency: "EUR",
    price_from: "45.00",
    meta: {
      source: "Next.js mock API",
    },
  });
}
