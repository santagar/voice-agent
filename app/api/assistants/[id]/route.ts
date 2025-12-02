import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.assistant.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("Failed to delete assistant:", err);
    return NextResponse.json(
      { error: "Failed to delete assistant" },
      { status: 500 }
    );
  }
}

