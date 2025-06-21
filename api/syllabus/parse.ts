import pdf from "pdf-parse";
import fs from "fs/promises";
import Tesseract from "tesseract.js";
import {
  extractTextbooks,
  extractGrading,
  extractDates,
  extractInstructorInfo,
} from "./regex";

export async function parseSyllabus(filePath: string, fileType: string) {
  let extractedText = "";

  try {
    if (fileType === "pdf") {
      const dataBuffer = await fs.readFile(filePath);
      const parsedData = await pdf(dataBuffer);
      extractedText = parsedData.text;
    } else if (fileType.startsWith("image")) {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng");
      extractedText = text;
    } else if (fileType === "markdown" || fileType === "md") {
      extractedText = await fs.readFile(filePath, "utf-8");
    } else {
      throw new Error("Unsupported file type");
    }
  } catch (error) {
    console.error("Error extracting text from syllabus:", error);
    return null;
  }

  return {
    instructor: extractInstructorInfo(extractedText),
    textbooks: extractTextbooks(extractedText),
    grading: extractGrading(extractedText),
    dates: extractDates(extractedText),
  };
}
