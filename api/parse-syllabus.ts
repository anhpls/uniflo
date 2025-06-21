import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface SyllabusEvent {
  type: string;
  title: string;
  dueDate: string | null;
  weekReference: string | null;
}

interface ParsedSyllabus {
  course: string;
  startDate: string | null;
  academicTerm: string | null;
  events: SyllabusEvent[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filePath } = req.body;

    // 1. Download and extract PDF text
    const { data: signedData } = await supabase.storage
      .from("syllabi")
      .createSignedUrl(filePath, 300);

    const fileBuffer = await axios
      .get<ArrayBuffer>(signedData!.signedUrl, {
        responseType: "arraybuffer",
      })
      .then((res) => Buffer.from(res.data));

    // Use pdf-parse to extract text from the PDF buffer
    // Install pdf-parse: npm install pdf-parse
    // Import at the top: import pdfParse from "pdf-parse";
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(fileBuffer);
    const pdfText: string = pdfData.text;

    // 2. Send to GPT for comprehensive parsing
    const parserPrompt = `You are an expert academic syllabus parser. Analyze this syllabus and:

1. Identify the course name
2. Determine the course start date (look for phrases like "course begins", "term starts", or infer from earliest event)
3. Note the academic term (Fall 2023, Spring 2024, etc.)
4. Extract all assignments, exams, quizzes with:
   - Exact dates (convert to YYYY-MM-DD)
   - Week references ("Week 5")
   - Both if available

Output JSON format:
{
  "course": "Course Name",
  "startDate": "YYYY-MM-DD or null",
  "academicTerm": "Term identifier or null",
  "events": [
    {
      "type": "Assignment|Exam|Quiz|Project",
      "title": "Name",
      "dueDate": "YYYY-MM-DD or null",
      "weekReference": "Week X or null"
    }
  ]
}

Be thorough but only include information actually found in the syllabus.`;

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: parserPrompt },
        { role: "user", content: pdfText },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0,
    });

    const rawResponse = visionResponse.choices[0].message.content;
    if (!rawResponse) throw new Error("Empty GPT response");

    const parsedData: ParsedSyllabus = JSON.parse(rawResponse);

    // 3. Calculate absolute dates for week references if start date exists
    const eventsWithResolvedDates = parsedData.startDate
      ? parsedData.events.map((event) => ({
          ...event,
          dueDate:
            event.weekReference && parsedData.startDate
              ? calculateDateFromWeek(event.weekReference, parsedData.startDate)
              : event.dueDate,
        }))
      : parsedData.events;

    // 4. Save to database
    const { data: course } = await supabase
      .from("courses")
      .insert({
        course_name: parsedData.course,
        start_date: parsedData.startDate,
        academic_term: parsedData.academicTerm,
      })
      .select()
      .single();

    const eventsToInsert = eventsWithResolvedDates.map((event) => ({
      course_id: course!.id,
      event_type: event.type,
      title: event.title,
      due_date: event.dueDate,
      week_reference: event.weekReference,
    }));

    await supabase.from("events").insert(eventsToInsert);

    return res.status(200).json({
      success: true,
      course: parsedData.course,
      startDate: parsedData.startDate,
      events: eventsWithResolvedDates,
    });
  } catch (err) {
    console.error("Parsing error:", err);
    return res.status(500).json({
      error: "Syllabus parsing failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

function calculateDateFromWeek(
  weekRef: string,
  startDate: string
): string | null {
  try {
    const weekNum = parseInt(weekRef.replace(/\D/g, ""));
    if (isNaN(weekNum)) return null;

    const start = new Date(startDate);
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + (weekNum - 1) * 7);
    return dueDate.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
