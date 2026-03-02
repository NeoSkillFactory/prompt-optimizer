#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { analyzePrompt, analyzeBatch, checkBestPracticeViolations, calculateConfidence, loadFailurePatterns } = require("./analyzer");
const { optimizePrompt, optimizeBatch, selectTemplate, loadTemplates } = require("./optimizer");

const SKILL_ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Analyzer Tests ──

console.log("\n=== Analyzer Tests ===\n");

console.log("-- loadFailurePatterns --");
const patterns = loadFailurePatterns();
assert(typeof patterns === "object", "loadFailurePatterns returns an object");
assert(Object.keys(patterns).length >= 5, "has at least 5 failure patterns");
assert(patterns.timeout !== undefined, "has timeout pattern");
assert(patterns.incomplete !== undefined, "has incomplete pattern");
assert(patterns.hallucination !== undefined, "has hallucination pattern");

console.log("\n-- calculateConfidence --");
const timeoutPattern = patterns.timeout;
const highConf = calculateConfidence(timeoutPattern, "the task timed out", "timeout error");
assert(highConf > 0.5, `timeout pattern matches timeout text (confidence: ${highConf})`);
const lowConf = calculateConfidence(timeoutPattern, "everything worked perfectly", "success");
assertEqual(lowConf, 0, "timeout pattern does not match success text");

console.log("\n-- checkBestPracticeViolations --");
const badPrompt = "Build a table";
const badViolations = checkBestPracticeViolations(badPrompt);
assert(badViolations.length >= 3, `short vague prompt has ${badViolations.length} violations`);

const goodPrompt =
  "You are a database builder agent. Context: Using PostgreSQL 15. " +
  "Task: Create a users table. Constraints: Must use UUID primary keys. " +
  "Output format: Return JSON with the SQL statement. On error, return error details.";
const goodViolations = checkBestPracticeViolations(goodPrompt);
assert(goodViolations.length < badViolations.length, "well-structured prompt has fewer violations");

console.log("\n-- analyzePrompt --");
const analysisResult = analyzePrompt({
  prompt: "Build a table",
  error: "incomplete output — missing column definitions",
  agentType: "db-builder",
  context: "PostgreSQL 15",
});
assert(analysisResult.patterns_found.length > 0, "finds failure patterns for bad prompt");
assert(analysisResult.best_practice_violations.length > 0, "finds best practice violations");
assert(typeof analysisResult.overall_quality === "number", "returns numeric quality score");
assert(analysisResult.overall_quality < 80, `quality score is low for bad prompt (${analysisResult.overall_quality})`);
assertEqual(analysisResult.agent_type, "db-builder", "preserves agent type");

console.log("\n-- analyzeBatch --");
const testPrompts = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "assets", "test-prompts.json"), "utf-8"));
const batchResult = analyzeBatch(testPrompts);
assertEqual(batchResult.total_prompts, testPrompts.length, `batch processes all ${testPrompts.length} prompts`);
assert(batchResult.average_quality >= 0 && batchResult.average_quality <= 100, "average quality is between 0-100");
assert(batchResult.results.length === testPrompts.length, "returns result for each prompt");

// ── Optimizer Tests ──

console.log("\n=== Optimizer Tests ===\n");

console.log("-- loadTemplates --");
const templates = loadTemplates();
assert(typeof templates === "object", "loadTemplates returns an object");
assert(templates["db-builder"] !== undefined, "has db-builder template");
assert(templates["general"] !== undefined, "has general template");
assert(templates["web-scraper"] !== undefined, "has web-scraper template");

console.log("\n-- selectTemplate --");
const dbTemplate = selectTemplate("db-builder");
assertEqual(dbTemplate.name, "Database Builder", "selects correct template for db-builder");
const fallback = selectTemplate("nonexistent-type");
assertEqual(fallback.name, "General Agent", "falls back to general for unknown type");

console.log("\n-- optimizePrompt --");
const optResult = optimizePrompt({
  id: "test-opt-1",
  prompt: "Build a table",
  error: "incomplete output",
  agentType: "db-builder",
  context: "PostgreSQL 15, users table for auth",
});
assertEqual(optResult.id, "test-opt-1", "preserves prompt id");
assert(optResult.original_prompt === "Build a table", "includes original prompt");
assert(optResult.analysis !== undefined, "includes analysis");
assert(optResult.optimized_variants.length === 3, "generates 3 variants by default");

for (let i = 0; i < optResult.optimized_variants.length; i++) {
  const v = optResult.optimized_variants[i];
  assertEqual(v.variant, i + 1, `variant ${i + 1} has correct number`);
  assert(v.prompt.length > optResult.original_prompt.length, `variant ${i + 1} is longer than original`);
  assert(typeof v.prompt === "string", `variant ${i + 1} is a string`);
}

console.log("\n-- optimizePrompt with custom variants --");
const opt2 = optimizePrompt(
  { prompt: "Do the thing", agentType: "general" },
  { maxVariants: 2, includeOriginal: false }
);
assertEqual(opt2.optimized_variants.length, 2, "respects maxVariants option");
assertEqual(opt2.original_prompt, undefined, "respects includeOriginal=false");

console.log("\n-- optimizeBatch --");
const batchOptResult = optimizeBatch(testPrompts.slice(0, 3));
assertEqual(batchOptResult.total_prompts, 3, "batch optimizes correct number of prompts");
assert(typeof batchOptResult.average_quality_before === "number", "includes average quality");
assert(batchOptResult.results.length === 3, "returns results for all prompts");

// ── CLI Integration Tests ──

console.log("\n=== CLI Integration Tests ===\n");

const mainScript = path.join(SKILL_ROOT, "scripts", "main.js");

console.log("-- help flag --");
try {
  const helpOut = execSync(`node "${mainScript}" --help`, { encoding: "utf-8" });
  assert(helpOut.includes("prompt-optimizer"), "help output contains tool name");
  assert(helpOut.includes("analyze"), "help output lists analyze action");
  assert(helpOut.includes("optimize"), "help output lists optimize action");
  assert(helpOut.includes("batch"), "help output lists batch action");
} catch (e) {
  failed++;
  console.error("  FAIL: --help should not exit with error");
}

console.log("\n-- analyze action --");
try {
  const analyzeOut = execSync(`node "${mainScript}" analyze --prompt "Build a table"`, { encoding: "utf-8" });
  const parsed = JSON.parse(analyzeOut);
  assert(typeof parsed.overall_quality === "number", "analyze returns quality score via CLI");
  assert(Array.isArray(parsed.best_practice_violations), "analyze returns violations via CLI");
} catch (e) {
  failed++;
  console.error(`  FAIL: analyze CLI — ${e.message}`);
}

console.log("\n-- optimize action --");
try {
  const optimizeOut = execSync(`node "${mainScript}" optimize --prompt "Build a table" --agent-type db-builder`, {
    encoding: "utf-8",
  });
  const parsed = JSON.parse(optimizeOut);
  assert(Array.isArray(parsed.optimized_variants), "optimize returns variants via CLI");
  assert(parsed.optimized_variants.length === 3, "optimize returns 3 variants via CLI");
} catch (e) {
  failed++;
  console.error(`  FAIL: optimize CLI — ${e.message}`);
}

console.log("\n-- batch action --");
const tmpOutput = path.join(SKILL_ROOT, "assets", "test-output");
try {
  const testPromptsPath = path.join(SKILL_ROOT, "assets", "test-prompts.json");
  execSync(`node "${mainScript}" batch --file "${testPromptsPath}" --output "${tmpOutput}"`, {
    encoding: "utf-8",
  });
  assert(fs.existsSync(path.join(tmpOutput, "batch-summary.json")), "batch creates summary file");
  assert(fs.existsSync(path.join(tmpOutput, "optimized-test-001.json")), "batch creates individual result files");
  const summary = JSON.parse(fs.readFileSync(path.join(tmpOutput, "batch-summary.json"), "utf-8"));
  assertEqual(summary.total_prompts, testPrompts.length, "batch summary has correct prompt count");
} catch (e) {
  failed++;
  console.error(`  FAIL: batch CLI — ${e.message}`);
} finally {
  // Clean up temp output
  if (fs.existsSync(tmpOutput)) {
    fs.rmSync(tmpOutput, { recursive: true });
  }
}

console.log("\n-- invalid action --");
try {
  execSync(`node "${mainScript}" invalid-action 2>&1`, { encoding: "utf-8" });
  failed++;
  console.error("  FAIL: invalid action should exit non-zero");
} catch (e) {
  assert(e.status !== 0, "invalid action exits non-zero");
}

console.log("\n-- missing required args --");
try {
  execSync(`node "${mainScript}" analyze 2>&1`, { encoding: "utf-8" });
  failed++;
  console.error("  FAIL: missing args should exit non-zero");
} catch (e) {
  assert(e.status !== 0, "missing args exits non-zero");
}

// ── Summary ──

console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(50) + "\n");

if (failed > 0) {
  process.exit(1);
}
