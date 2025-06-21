import { db } from "@/lib/db"; // Adjust based on your actual DB connection setup

interface ParsedData {
  instructor: {
    name: string;
    email: string;
    officeHours: string;
  } | null;
  textbooks: {
    title: string;
    author: string;
    type: string;
  }[];
  grading: {
    category: string;
    weight: number;
  }[];
  dates: string[];
}

export async function storeParsedData(parsedData: ParsedData) {
  try {
    const { instructor, textbooks, grading, dates } = parsedData;

    let courseId: number | null = null;

    if (instructor) {
      const course = await db.query(
        "INSERT INTO courses (professor_name, professor_email, office_hours) VALUES ($1, $2, $3) RETURNING id",
        [instructor.name, instructor.email, instructor.officeHours]
      );

      courseId = course.rows[0].id;
    }

    for (const book of textbooks) {
      await db.query(
        "INSERT INTO textbooks (course_id, title, author, type) VALUES ($1, $2, $3, $4)",
        [courseId, book.title, book.author, book.type]
      );
    }

    for (const grade of grading) {
      await db.query(
        "INSERT INTO grading_weights (course_id, category, weight) VALUES ($1, $2, $3)",
        [courseId, grade.category, grade.weight]
      );
    }

    for (const date of dates) {
      await db.query(
        "INSERT INTO important_dates (course_id, date) VALUES ($1, $2)",
        [courseId, date]
      );
    }

    console.log("Data stored successfully!");
  } catch (error) {
    console.error("Error storing syllabus data:", error);
  }
}
