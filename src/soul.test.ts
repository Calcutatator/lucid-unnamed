import { test, expect, describe } from "bun:test";
import {
  getSoulProfile,
  buildSystemPrompt,
  validateSoulProfile,
  loadSoulFile,
} from "./soul";

describe("loadSoulFile", () => {
  test("loads SOUL.md", () => {
    const content = loadSoulFile("SOUL.md");
    expect(content).toContain("Peter Steinberger");
    expect(content).toContain("@steipete");
  });

  test("loads STYLE.md", () => {
    const content = loadSoulFile("STYLE.md");
    expect(content).toContain("## Voice");
    expect(content).toContain("## Vocabulary");
  });

  test("loads SKILL.md", () => {
    const content = loadSoulFile("SKILL.md");
    expect(content).toContain("## Modes");
  });

  test("throws for missing file", () => {
    expect(() => loadSoulFile("NONEXISTENT.md")).toThrow();
  });
});

describe("getSoulProfile", () => {
  test("returns all profile components", () => {
    const profile = getSoulProfile();
    expect(profile.soul).toBeTruthy();
    expect(profile.style).toBeTruthy();
    expect(profile.skill).toBeTruthy();
    expect(profile.examples.good).toBeTruthy();
    expect(profile.examples.bad).toBeTruthy();
    expect(profile.examples.calibration).toBeTruthy();
  });

  test("soul contains identity and beliefs", () => {
    const profile = getSoulProfile();
    expect(profile.soul).toContain("## Identity");
    expect(profile.soul).toContain("## Core Beliefs");
    expect(profile.soul).toContain("## Opinions");
    expect(profile.soul).toContain("ClawFather");
    expect(profile.soul).toContain("OpenClaw");
    expect(profile.soul).toContain("PSPDFKit");
  });

  test("style contains voice and vocabulary sections", () => {
    const profile = getSoulProfile();
    expect(profile.style).toContain("## Voice");
    expect(profile.style).toContain("## Sentence Structure");
    expect(profile.style).toContain("## Vocabulary");
    expect(profile.style).toContain("### Signature phrases");
    expect(profile.style).toContain("Just talk to it");
    expect(profile.style).toContain("The claw is the law");
  });

  test("examples have sufficient quantity", () => {
    const profile = getSoulProfile();
    const goodCount = (profile.examples.good.match(/^## Example \d+/gm) || [])
      .length;
    const badCount = (profile.examples.bad.match(/^## Example \d+/gm) || [])
      .length;
    expect(goodCount).toBeGreaterThanOrEqual(5);
    expect(badCount).toBeGreaterThanOrEqual(5);
  });

  test("calibration contains real quotes", () => {
    const profile = getSoulProfile();
    const quoteCount = (profile.examples.calibration.match(/^>/gm) || [])
      .length;
    expect(quoteCount).toBeGreaterThanOrEqual(5);
    expect(profile.examples.calibration).toContain("Claudoholic");
    expect(profile.examples.calibration).toContain("Just talk to it");
  });
});

describe("buildSystemPrompt", () => {
  test("builds prompt with default blog mode", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Peter Steinberger");
    expect(prompt).toContain("Current mode: blog");
    expect(prompt).toContain("Write in-character");
  });

  test("builds prompt with tweet mode", () => {
    const prompt = buildSystemPrompt("tweet");
    expect(prompt).toContain("Current mode: tweet");
  });

  test("includes soul and style content", () => {
    const prompt = buildSystemPrompt("reply");
    expect(prompt).toContain("## Core Beliefs");
    expect(prompt).toContain("## Voice");
    expect(prompt).toContain("## Modes");
  });
});

describe("validateSoulProfile", () => {
  test("validates successfully with no errors", () => {
    const result = validateSoulProfile();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("has no warnings for complete profile", () => {
    const result = validateSoulProfile();
    expect(result.warnings).toHaveLength(0);
  });

  test("reports correct stats", () => {
    const result = validateSoulProfile();
    expect(result.stats.soulLines).toBeGreaterThan(20);
    expect(result.stats.styleLines).toBeGreaterThan(20);
    expect(result.stats.skillLines).toBeGreaterThan(10);
    expect(result.stats.goodExamples).toBeGreaterThanOrEqual(5);
    expect(result.stats.badExamples).toBeGreaterThanOrEqual(5);
    expect(result.stats.calibrationQuotes).toBeGreaterThanOrEqual(5);
  });
});

describe("content quality checks", () => {
  test("soul contains prediction-grade opinions", () => {
    const profile = getSoulProfile();
    // Specific, debatable takes — not vague statements
    expect(profile.soul).toContain("Claude Code");
    expect(profile.soul).toContain("codex");
    expect(profile.soul).toContain("context tax");
  });

  test("good examples match voice patterns", () => {
    const profile = getSoulProfile();
    // Good examples should contain steipete-isms
    expect(profile.examples.good).toContain("blast radius");
    expect(profile.examples.good).toContain("🦞");
  });

  test("bad examples explain why they fail", () => {
    const profile = getSoulProfile();
    // Bad examples should contain explanations
    expect(profile.examples.bad).toContain("Why it's wrong");
  });

  test("style captures em dash usage", () => {
    const profile = getSoulProfile();
    expect(profile.style).toContain("Em dashes");
    expect(profile.style).toContain("—");
  });
});
