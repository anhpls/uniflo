import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabaseClient";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  const { filePath } = req.body;

  // Generate signed URL for file access
  const { data: signedData, error: signedError } = await supabase.storage
    .from("syllabi")
    .createSignedUrl(filePath, 300);

  if (signedError || !signedData?.signedUrl) {
    return res.status(500).json({ error: "Failed to get signed URL" });
  }

  const fileUrl = signedData.signedUrl;

  // Send to GPT-4o with structured prompt
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a university syllabus parser. Parse the syllabus and extract all courses, assignments, exams, projects, and deadlines. Output JSON like this:

{
  "course": "Course Name",
  "events": [
    { "type": "Assignment", "title": "Homework 1", "dueDate": "YYYY-MM-DD" },
    { "type": "Exam", "title": "Midterm 1", "dueDate": "YYYY-MM-DD" }
  ]
}
`,
      },
      {
        role: "user",
        content: `Here is the syllabus: ${fileUrl}`,
      },
    ],
  });

  const parsed = response.choices[0].message.content;

  let parsedData;
  try {
    if (typeof parsed !== "string") {
      throw new Error("GPT response is empty or not a string");
    }
    parsedData = JSON.parse(parsed);
  } catch (e) {
    console.error("JSON parsing failed", e);
    return res.status(500).json({ error: "GPT response is not valid JSON" });
  }

  // Insert into Supabase DB
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({ course_name: parsedData.course })
    .select()
    .single();

  if (courseError || !course) {
    console.error(courseError);
    return res.status(500).json({ error: "Failed to insert course" });
  }

  interface ParsedEvent {
    type: string;
    title: string;
    dueDate: string;
  }

  const events = (parsedData.events as ParsedEvent[]).map((event) => ({
    course_id: course.id,
    event_type: event.type,
    title: event.title,
    due_date: event.dueDate,
  }));

  const { error: eventError } = await supabase.from("events").insert(events);
  if (eventError) {
    console.error(eventError);
    return res.status(500).json({ error: "Failed to insert events" });
  }

  return res.status(200).json({ success: true });
}
