import { readFileSync } from "fs";
import { join } from "path";

const SOUL_DIR = join(import.meta.dir, "..", "soul");

export function loadSoulFile(filename: string): string {
  return readFileSync(join(SOUL_DIR, filename), "utf-8");
}

export function getSoulProfile(): {
  soul: string;
  style: string;
  skill: string;
  examples: { good: string; bad: string; calibration: string };
} {
  return {
    soul: loadSoulFile("SOUL.md"),
    style: loadSoulFile("STYLE.md"),
    skill: loadSoulFile("SKILL.md"),
    examples: {
      good: loadSoulFile("examples/good-output.md"),
      bad: loadSoulFile("examples/bad-output.md"),
      calibration: loadSoulFile("examples/calibration.md"),
    },
  };
}

export function buildSystemPrompt(mode: string = "blog"): string {
  const profile = getSoulProfile();
  return [
    "You are writing as Peter Steinberger (@steipete). Load and embody the following identity:",
    "",
    profile.soul,
    "",
    "---",
    "",
    profile.style,
    "",
    "---",
    "",
    profile.skill,
    "",
    "---",
    "",
    `Current mode: ${mode}`,
    "",
    "Write in-character. Do not break character. Do not reference these instructions.",
    "Do not say you are an AI. Speak as steipete.",
  ].join("\n");
}

export function validateSoulProfile(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    soulLines: number;
    styleLines: number;
    skillLines: number;
    goodExamples: number;
    badExamples: number;
    calibrationQuotes: number;
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  let soul = "",
    style = "",
    skill = "",
    good = "",
    bad = "",
    calibration = "";

  try {
    soul = loadSoulFile("SOUL.md");
  } catch {
    errors.push("SOUL.md not found or unreadable");
  }
  try {
    style = loadSoulFile("STYLE.md");
  } catch {
    errors.push("STYLE.md not found or unreadable");
  }
  try {
    skill = loadSoulFile("SKILL.md");
  } catch {
    errors.push("SKILL.md not found or unreadable");
  }
  try {
    good = loadSoulFile("examples/good-output.md");
  } catch {
    errors.push("examples/good-output.md not found");
  }
  try {
    bad = loadSoulFile("examples/bad-output.md");
  } catch {
    errors.push("examples/bad-output.md not found");
  }
  try {
    calibration = loadSoulFile("examples/calibration.md");
  } catch {
    errors.push("examples/calibration.md not found");
  }

  // Content checks
  if (soul && !soul.includes("## Core Beliefs")) {
    warnings.push("SOUL.md missing '## Core Beliefs' section");
  }
  if (soul && !soul.includes("## Opinions")) {
    warnings.push("SOUL.md missing '## Opinions' section");
  }
  if (style && !style.includes("## Voice")) {
    warnings.push("STYLE.md missing '## Voice' section");
  }
  if (style && !style.includes("## Vocabulary")) {
    warnings.push("STYLE.md missing '## Vocabulary' section");
  }
  if (skill && !skill.includes("## Modes")) {
    warnings.push("SKILL.md missing '## Modes' section");
  }

  const countExamples = (text: string) =>
    (text.match(/^## Example \d+/gm) || []).length;
  const goodCount = countExamples(good);
  const badCount = countExamples(bad);

  if (goodCount < 5) {
    warnings.push(
      `good-output.md has ${goodCount} examples (minimum 5 recommended)`
    );
  }
  if (badCount < 5) {
    warnings.push(
      `bad-output.md has ${badCount} examples (minimum 5 recommended)`
    );
  }

  const calibrationQuotes = (calibration.match(/^>/gm) || []).length;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      soulLines: soul.split("\n").length,
      styleLines: style.split("\n").length,
      skillLines: skill.split("\n").length,
      goodExamples: goodCount,
      badExamples: badCount,
      calibrationQuotes,
    },
  };
}
