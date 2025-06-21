import { NextRequest, NextResponse } from "next/server";
import { parseSyllabus } from "./syllabus/parse";
import { storeParsedData } from "./syllabus/store";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("syllabus") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file uploaded." },
        { status: 400 }
      );
    }

    // Save uploaded file temporarily
    const tempDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Determine file type
    const fileType = file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("image")
      ? "image"
      : "markdown";

    // Parse the syllabus
    const parsedData = await parseSyllabus(filePath, fileType);
    if (!parsedData) {
      return NextResponse.json(
        { message: "Failed to parse syllabus." },
        { status: 500 }
      );
    }

    // Convert grading weights from string to number
    const convertedParsedData = {
      ...parsedData,
      grading: parsedData.grading.map((grade) => ({
        ...grade,
        weight: parseFloat(grade.weight),
      })),
    };

    // Store parsed data in the database
    await storeParsedData(convertedParsedData);

    return NextResponse.json({
      message: "File uploaded and parsed successfully.",
      data: parsedData,
    });
  } catch (error) {
    console.error("Error in file upload:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
