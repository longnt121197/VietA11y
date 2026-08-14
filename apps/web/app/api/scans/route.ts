import { NextResponse } from "next/server";

import {
  createInvalidJsonResult,
  createScanApiResult,
} from "./scan-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<NextResponse> {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    const result = createInvalidJsonResult();
    return NextResponse.json(result.body, {
      status: result.status,
      headers: noStoreHeaders,
    });
  }

  const result = await createScanApiResult(input);

  return NextResponse.json(result.body, {
    status: result.status,
    headers: noStoreHeaders,
  });
}
