import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: false,
    message: "DigitalRx API polling has been disabled. Status updates are now received exclusively via webhook at /api/webhook/digitalrx. Use /api/admin/webhook-monitor to check webhook health.",
  }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({
    success: false,
    message: "DigitalRx API polling has been disabled. Status updates are now received exclusively via webhook at /api/webhook/digitalrx. Use /api/admin/webhook-monitor to check webhook health.",
  }, { status: 410 });
}
