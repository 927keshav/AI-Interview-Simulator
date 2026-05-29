export type ResumeParseResult = {
  experience: string[];
  inferredRole: string;
  inferredSeniority: string;
  projects: string[];
  skills: string[];
  sourceText: string;
  warnings: string[];
};

const SKILL_KEYWORDS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Python",
  "Django",
  "Flask",
  "FastAPI",
  "Java",
  "Spring",
  "C#",
  ".NET",
  "Go",
  "Rust",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "CI/CD",
  "GraphQL",
  "REST",
  "HTML",
  "CSS",
  "Tailwind",
  "Figma",
  "Jest",
  "Playwright",
  "Cypress",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NLP",
  "Hugging Face",
  "Spark",
];

const ROLE_RULES = [
  { label: "Frontend Engineer", terms: ["react", "next.js", "frontend", "ui", "css"] },
  { label: "Backend Engineer", terms: ["node.js", "express", "api", "database", "backend"] },
  { label: "Full Stack Engineer", terms: ["full stack", "react", "node.js", "frontend", "backend"] },
  { label: "DevOps Engineer", terms: ["docker", "kubernetes", "aws", "ci/cd", "terraform"] },
  { label: "Data Scientist", terms: ["python", "pandas", "machine learning", "tensorflow", "pytorch"] },
  { label: "Mobile Engineer", terms: ["react native", "android", "ios", "swift", "kotlin"] },
  { label: "QA Engineer", terms: ["qa", "test automation", "playwright", "cypress", "selenium"] },
];

function normalizeText(text: string) {
  const collapsedLetterSpacing = text.replace(
    /\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g,
    (match) => match.replace(/\s+/g, ""),
  );

  return collapsedLetterSpacing
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(
      /(WORK EXPERIENCE|EXPERIENCE|PROJECTS|PROJECT EXPERIENCE|SKILLS|TECHNICAL SKILLS|CERTIFICATIONS|EDUCATION)/g,
      "\n$1\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLines(text: string) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

function sectionLines(lines: string[], headings: string[]) {
  const normalizedHeadings = headings.map((heading) => heading.toLowerCase());
  const boundaryWords = [
    "education",
    "experience",
    "work",
    "work experience",
    "employment",
    "projects",
    "project experience",
    "skills",
    "technical skills",
    "certifications",
    "summary",
    "profile",
  ];
  const collected: string[] = [];
  let active = false;

  for (const line of lines) {
    const lower = line.toLowerCase().replace(/[:\-]/g, "").trim();
    const isHeading = normalizedHeadings.some((heading) => lower === heading);
    const isBoundary =
      active &&
      boundaryWords.some((word) => lower === word || lower === `${word} history`);

    if (isHeading) {
      active = true;
      continue;
    }

    if (isBoundary) {
      active = false;
    }

    if (active && line.length > 2) {
      collected.push(line);
    }
  }

  return collected
    .flatMap((line) =>
      line
        .split(/(?<=[.!?])\s+|(?=[A-Z][a-z]+ed\b)|(?=[A-Z][a-z]+ing\b)/)
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .slice(0, 8);
}

function extractSkills(text: string) {
  const lower = text.toLowerCase();
  const found = SKILL_KEYWORDS.filter((skill) => lower.includes(skill.toLowerCase()));

  return [...new Set(found)].slice(0, 18);
}

function extractExperience(lines: string[]) {
  const section = sectionLines(lines, ["experience", "work experience", "employment"]);
  const sentences = lines.flatMap((line) =>
    line
      .split(/(?<=[.!?])\s+|(?=[A-Z][a-z]+ed\b)|(?=[A-Z][a-z]+ing\b)/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const datedLines = sentences.filter((line) =>
    /\b(20\d{2}|19\d{2}|present|current)\b/i.test(line),
  );

  return [...new Set([...section, ...datedLines])]
    .filter((line) => line.length < 180)
    .slice(0, 8);
}

function extractProjects(lines: string[]) {
  const section = sectionLines(lines, ["projects", "project experience"]);
  const sentences = lines.flatMap((line) =>
    line
      .split(/(?<=[.!?])\s+|(?=[A-Z][a-z]+ed\b)|(?=[A-Z][a-z]+ing\b)/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const projectLike = sentences.filter((line) =>
    /\b(built|created|developed|designed|implemented|launched|project)\b/i.test(line),
  );

  return [...new Set([...section, ...projectLike])]
    .filter((line) => line.length < 220)
    .slice(0, 8);
}

function inferRole(text: string, skills: string[]) {
  const lower = `${text} ${skills.join(" ")}`.toLowerCase();
  const ranked = ROLE_RULES.map((rule) => ({
    label: rule.label,
    score: rule.terms.filter((term) => lower.includes(term)).length,
  })).sort((a, b) => b.score - a.score);

  return ranked[0]?.score ? ranked[0].label : "Software Engineer";
}

function inferSeniority(text: string, experience: string[]) {
  const lower = `${text} ${experience.join(" ")}`.toLowerCase();
  const yearMatches = [...lower.matchAll(/\b(\d+)\+?\s*(years|yrs)\b/g)].map((match) =>
    Number(match[1]),
  );
  const maxYears = Math.max(...yearMatches, 0);

  if (lower.includes("principal") || lower.includes("staff") || maxYears >= 8) {
    return "Senior";
  }

  if (lower.includes("senior") || lower.includes("lead") || maxYears >= 5) {
    return "Senior";
  }

  if (lower.includes("mid") || maxYears >= 2) {
    return "Mid Level";
  }

  if (lower.includes("intern") || lower.includes("student")) {
    return "Intern";
  }

  return "Junior";
}

export function parseResumeText(text: string): ResumeParseResult {
  const sourceText = normalizeText(text);
  const warnings: string[] = [];

  if (sourceText.length < 80) {
    warnings.push("Resume text is short, so inference may be less reliable.");
  }

  const lines = splitLines(sourceText);
  const skills = extractSkills(sourceText);
  const experience = extractExperience(lines);
  const projects = extractProjects(lines);

  if (skills.length === 0) {
    warnings.push("No common technical skills were detected.");
  }

  return {
    experience,
    inferredRole: inferRole(sourceText, skills),
    inferredSeniority: inferSeniority(sourceText, experience),
    projects,
    skills,
    sourceText,
    warnings,
  };
}
