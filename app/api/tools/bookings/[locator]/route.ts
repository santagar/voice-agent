import { NextRequest, NextResponse } from "next/server";

const MOCK_BOOKINGS: Record<
  string,
  {
    locator: string;
    leadTraveler: string;
    status: "confirmed" | "cancelled" | "pending";
    checkIn: string;
    checkOut: string;
    total: string;
    currency: string;
    history: Array<{ ts: string; event: string }>;
  }
> = {
  ABC123: {
    locator: "ABC123",
    leadTraveler: "María García",
    status: "confirmed",
    checkIn: "2024-06-15",
    checkOut: "2024-06-18",
    total: "540.00",
    currency: "EUR",
    history: [
      { ts: "2024-05-01T10:15:00Z", event: "Created from partner API" },
      { ts: "2024-05-05T08:00:00Z", event: "Payment confirmed" },
    ],
  },
  ZX9001: {
    locator: "ZX9001",
    leadTraveler: "Daniel Ortega",
    status: "pending",
    checkIn: "2024-07-10",
    checkOut: "2024-07-12",
    total: "210.00",
    currency: "EUR",
    history: [{ ts: "2024-05-20T09:30:00Z", event: "Reservation requested" }],
  },
};

export async function GET(
  _req: NextRequest,
  context: { params: { locator: string } }
) {
  const raw = await context.params;
  const rawLocator = raw?.locator?.toUpperCase();

  if (!rawLocator) {
    return NextResponse.json(
      { error: "Missing locator parameter" },
      { status: 400 }
    );
  }

  const booking = MOCK_BOOKINGS[rawLocator];

  if (!booking) {
    return NextResponse.json(
      { error: `Booking ${rawLocator} not found.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    locator: booking.locator,
    status: booking.status,
    lead_traveler: booking.leadTraveler,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    total_price: booking.total,
    currency: booking.currency,
    history: booking.history,
  });
}
