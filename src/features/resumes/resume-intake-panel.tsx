"use client";

import {
  BriefcaseBusiness,
  FileText,
  Layers,
  Lightbulb,
  Upload,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { extractResumeFileText } from "@/features/resumes/resume-file-parser";
import { parseResumeText, type ResumeParseResult } from "@/features/resumes/resume-parser";

export function ResumeIntakePanel() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseText(text: string) {
    const trimmedText = text.trim();

    if (trimmedText.length < 5) {
      setResult(null);
      setStatusMessage(null);
      setError("Paste resume text or upload a resume before parsing.");
      return;
    }

    setError(null);
    const parsed = parseResumeText(trimmedText);

    setResult(parsed);
    setStatusMessage(
      `Parsed ${parsed.sourceText.length} characters. Found ${parsed.skills.length} skills, ${parsed.experience.length} experience entries, and ${parsed.projects.length} projects.`,
    );
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setFileName(file.name);
    setError(null);
    startTransition(async () => {
      try {
        const extractedText = await extractResumeFileText(file);

        setResumeText(extractedText);
        parseText(extractedText);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Could not parse this resume file.";

        setError(`${message} Paste the resume text below to continue.`);
        setStatusMessage(null);
      }
    });
  }

  return (
    <section className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Resume system</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Upload a resume or paste text to extract skills, experience,
              projects, role fit, and seniority signals.
            </p>
          </div>
        </div>

        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition hover:border-sky-300 hover:bg-white">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Reading..." : "Upload PDF/DOCX"}
          <input
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => handleFile(event.target.files?.[0])}
            type="file"
          />
        </label>
      </div>

      {fileName ? (
        <p className="mt-4 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          Loaded file: {fileName}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <label className="text-sm font-medium" htmlFor="resumeText">
            Pasted resume text
          </label>
          <textarea
            className="field-hover mt-2 min-h-64 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="resumeText"
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste resume text here if you do not want to upload a file."
            value={resumeText}
          />
          {error ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {statusMessage}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <Button disabled={isPending} onClick={() => parseText(resumeText)} type="button">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              Parse resume
            </Button>
            <Button
              disabled={!resumeText && !result}
              onClick={() => {
                setResumeText("");
                setResult(null);
                setError(null);
                setStatusMessage(null);
                setFileName(null);
              }}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <InferenceCard
            icon={UserRoundCheck}
            label="Role inference"
            value={result?.inferredRole ?? "-"}
          />
          <InferenceCard
            icon={BriefcaseBusiness}
            label="Seniority inference"
            value={result?.inferredSeniority ?? "-"}
          />
          <ExtractionList
            emptyLabel="No skills extracted yet"
            icon={Layers}
            items={result?.skills ?? []}
            title="Skill extraction"
          />
        </div>
      </div>

      {result ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ExtractionList
            emptyLabel="No experience entries detected"
            icon={BriefcaseBusiness}
            items={result.experience}
            title="Experience extraction"
          />
          <ExtractionList
            emptyLabel="No projects detected"
            icon={Lightbulb}
            items={result.projects}
            title="Project extraction"
          />
          <div className="rounded-lg border bg-background p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold">Parser notes</h3>
            {result.warnings.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {result.warnings.map((warning) => (
                  <li className="text-sm leading-6 text-muted-foreground" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Resume parsed successfully.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InferenceCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-sky-50 text-sky-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ExtractionList({
  emptyLabel,
  icon: Icon,
  items,
  title,
}: {
  emptyLabel: string;
  icon: LucideIcon;
  items: string[];
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-emerald-50 text-emerald-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              className="rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
