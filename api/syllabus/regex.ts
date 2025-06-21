export function extractInstructorInfo(text: string) {
  const match = text.match(
    /Instructor:\s*(?<name>[\w\s.]+)[\n\r]+Email:\s*(?<email>[^\s]+)[\n\r]+(?:Office Hours:\s*(?<officeHours>.*))?/i
  );
  return match
    ? {
        name: match.groups?.name || "Unknown",
        email: match.groups?.email || "Unknown",
        officeHours: match.groups?.officeHours || "Not provided",
      }
    : null;
}

export function extractTextbooks(text: string) {
  const matches = [
    ...text.matchAll(
      /(Required|Optional) Textbook:\s*(?<title>.*?),\s*by\s*(?<author>[\w\s]+)/gi
    ),
  ];
  return matches.map((match) => ({
    type: match[1],
    title: match.groups?.title || "Unknown",
    author: match.groups?.author || "Unknown",
  }));
}

export function extractGrading(text: string) {
  const matches = [...text.matchAll(/([\w\s]+):\s*(?<weight>\d+)%/gi)];
  return matches.map((match) => ({
    category: match[1].trim(),
    weight: match.groups?.weight + "%",
  }));
}

export function extractDates(text: string) {
  const matches = [
    ...text.matchAll(
      /(\b(?:\w+\s\d{1,2},\s\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b)/g
    ),
  ];
  return matches.map((match) => match[1]);
}
