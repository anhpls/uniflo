import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import axios from "axios";
import pdf from "pdf-parse";

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
    const { filePath } = req.body;

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

    // 3. Parse with OpenAI
    const parserPrompt = `Extract ALL syllabus information including:
- Course name (required)
- Instructor info (name, email, office hours)
- Textbooks (title, author, ISBN if available)
- Grading policy (breakdown, scale)
- All important dates (exams, assignments)

Return as JSON with this structure:
{
  "course": string,
  "instructor": {
    "name": string,
    "email": string,
    "officeHours": string
  },
  "textbooks": string[],
  "grading": {
    "breakdown": string,
    "scale": string
  },
  "events": Array<{
    "type": "Assignment"|"Exam"|"Quiz"|"Project",
    "title": string,
    "dueDate": string|null,
    "weekReference": string|null
  }>
}`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: parserPrompt },
        { role: "user", content: pdfText },
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
