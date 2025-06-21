import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json();

    // 1. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("syllabi")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download file from storage" },
        { status: 400 }
      );
    }

    // 2. Convert to text (simple approach for demo)
    // In production, consider using a PDF service or different parser
    const arrayBuffer = await fileData.arrayBuffer();
    const textDecoder = new TextDecoder("utf-8");
    const pdfText = textDecoder.decode(arrayBuffer.slice(0, 10000)); // Limit size for demo

    // 3. Parse with OpenAI
    const parserPrompt = `
You are a syllabus parser. Your task is to extract as much structured information as possible. If a field is missing, leave it as an empty string. Do NOT fabricate information, but if information is partially available, include it.

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
${pdfText}
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: parserPrompt },
        { role: "user", content: pdfText },
      ],
      response_format: { type: "json_object" },
    });

    const parsedData = JSON.parse(
      aiResponse.choices[0]?.message?.content || "{}"
    );

    // 4. Save to database
    const { data: course, error: dbError } = await supabase
      .from("courses")
      .insert({
        name: parsedData.course,
        instructor: parsedData.instructor,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Save assignments if they exist
    if (parsedData.assignments?.length > 0) {
      type Assignment = {
        title: string;
        dueDate: string;
        type?: string;
      };

      await supabase.from("assignments").insert(
        (parsedData.assignments as Assignment[]).map((a) => ({
          course_id: course.id,
          title: a.title,
          due_date: a.dueDate,
          type: a.type || "assignment",
        }))
      );
    }

    return NextResponse.json({
      success: true,
      course: course.name,
      assignmentsCount: parsedData.assignments?.length || 0,
    });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Failed to process syllabus" },
      { status: 500 }
    );
  }
}
