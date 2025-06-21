import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import axios from "axios";
import pdf from "pdf-parse";
import { parse, addWeeks, format } from "date-fns";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filePath, startDate } = req.body;

    // 1. Download PDF from Supabase
    const { data: signedData } = await supabase.storage
      .from("syllabi")
      .createSignedUrl(filePath, 3600);

    if (!signedData?.signedUrl) {
      throw new Error("Failed to get signed URL");
    }

    // 2. Extract text using pdf-parse
    const response = await axios.get(signedData.signedUrl, {
      responseType: "arraybuffer",
    });
    const arrayBuffer = response.data as ArrayBuffer;
    const data = await pdf(Buffer.from(arrayBuffer));
    const pdfText = data.text;

    const normalizedText = convertWeeksToDates(pdfText, startDate);
    // 3. Parse with OpenAI
    const parserPrompt = `You are a syllabus parser. Your task is to extract as much structured information as possible. If a field is missing, leave it as an empty string. Do NOT fabricate information, but if information is partially available, include it.

Schema:

{
  "course": "Course Name (string)",
  "instructor": {
    "name": "Instructor Name (string)",
    "email": "Instructor Email (string)",
    "officeHours": "Office Hours (string)"
  },
  "textbooks": [
    {
      "title": "Textbook Title (string)",
      "author": "Author Name (string)",
      "isbn": "ISBN (string)"
    }
  ],
  "assignments": [
    {
      "title": "Assignment Title (string)",
      "dueDate": "YYYY-MM-DD (string",
      "type": "Assignment | Exam | Quiz | Project"
    }
  ]
}

Rules:

- Extract course name from the syllabus text; usually at the top of the syllabus or large text
- Always Extract instructor information, including name, email, and office hours.
- Office hours can be a string like "MWF 2-3pm" or "By appointment". It is text that is always near the instructor's name or email.
- Extract assignments with titles and due dates.
- For textbooks, extract titles and authors, and isbn if available.
- For assignments: find assignments in YYYY-MM-DD format.
- Output ONLY valid JSON, no markdown, no explanation, no extra text.
- Do not wrap output in code blocks.

Syllabus Text:
${normalizedText}
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: parserPrompt },
        { role: "user", content: normalizedText },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const parsedData = JSON.parse(
      aiResponse.choices[0]?.message?.content || "{}"
    );

    // 4. Save to database
    const { data: course } = await supabase
      .from("courses")
      .insert({
        course_name: parsedData.course,
        instructor: parsedData.instructor,
        textbooks: parsedData.textbooks,
        grading: parsedData.grading,
      })
      .select()
      .single();

    if (!course) throw new Error("Failed to save course");

    type ParsedEvent = {
      type: "Assignment" | "Exam" | "Quiz" | "Project";
      title: string;
      dueDate: string | null;
      weekReference: string | null;
    };

    const eventsToInsert = (parsedData.events || []).map(
      (event: ParsedEvent) => ({
        course_id: course.id,
        event_type: event.type || "Assignment",
        title: event.title,
        due_date: event.dueDate,
        week_reference: event.weekReference,
      })
    );

    await supabase.from("events").insert(eventsToInsert);

    return res.status(200).json({
      success: true,
      data: {
        course: parsedData.course,
        events: eventsToInsert.length,
        instructor: parsedData.instructor,
      },
    });
  } catch (error) {
    console.error("Syllabus parsing failed:", error);
    return res.status(500).json({
      error: "Syllabus parsing failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
/**
 * Attempts to replace week references (e.g., "Week 1", "Week 2") in the syllabus text
 * with their corresponding date ranges, based on the provided course start date.
 *
 * @param pdfText The syllabus text extracted from the PDF.
 * @param startDate The course start date as a string (YYYY-MM-DD) or Date object.
 * @returns The syllabus text with week references replaced by date ranges.
 */
function convertWeeksToDates(pdfText: string, startDate: string | Date) {
  if (!startDate) return pdfText;

  let baseDate: Date;
  if (typeof startDate === "string") {
    // Accepts "YYYY-MM-DD" or ISO string
    baseDate = parse(startDate, "yyyy-MM-dd", new Date());
    if (isNaN(baseDate.getTime())) {
      baseDate = new Date(startDate);
    }
  } else {
    baseDate = startDate;
  }

  // Replace "Week X" with "Week X (YYYY-MM-DD to YYYY-MM-DD)"
  return pdfText.replace(/Week\s*(\d+)/gi, (match, weekNumStr) => {
    const weekNum = parseInt(weekNumStr, 10);
    if (isNaN(weekNum)) return match;
    const weekStart = addWeeks(baseDate, weekNum - 1);
    const weekEnd = addWeeks(baseDate, weekNum - 1);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    return `Week ${weekNum} (${startStr} to ${endStr})`;
  });
}
