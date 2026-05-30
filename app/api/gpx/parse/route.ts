import { NextResponse } from "next/server";
import { isGpxParseError, parseGpxContent } from "@/lib/gpx/parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "PARSE_ERROR", message: "No file provided" } },
        { status: 400 },
      );
    }

    const content = await file.text();
    const roadbook = parseGpxContent(content, file.name);

    return NextResponse.json({ roadbook });
  } catch (error) {
    if (isGpxParseError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: { code: "PARSE_ERROR", message: "Unable to parse GPX file" } },
      { status: 500 },
    );
  }
}
