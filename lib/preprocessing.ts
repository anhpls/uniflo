import { parseISO, addWeeks, format } from "date-fns";

// Converts week numbers to absolute dates inside syllabus text
export function convertWeeksToDates(
  syllabusText: string,
  startDate: string
): string {
  const weekPattern = /Week\s*(\d+)/gi;

  return syllabusText.replace(weekPattern, (match, weekNumStr) => {
    const weekNum = parseInt(weekNumStr);
    if (!isNaN(weekNum)) {
      // Subtract 1 because "Week 1" means start date itself
      const absoluteDate = addWeeks(parseISO(startDate), weekNum - 1);
      const formattedDate = format(absoluteDate, "yyyy-MM-dd");
      return `${match} (Starts on ${formattedDate})`;
    }
    return match; // if no match, return original
  });
}
