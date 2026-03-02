#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SKILL_ROOT = path.resolve(__dirname, "..");

/**
 * Load failure patterns from references.
 */
function loadFailurePatterns() {
  const filePath = path.join(SKILL_ROOT, "references", "failure-patterns.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Load best practices text from references.
 */
function loadBestPractices() {
  const filePath = path.join(SKILL_ROOT, "references", "best-practices.md");
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Calculate a confidence score for how well a failure pattern matches a prompt + error.
 * Returns a value between 0 and 1.
 */
function calculateConfidence(pattern, promptText, errorText) {
  const combined = `${promptText} ${errorText}`.toLowerCase();
  let matchCount = 0;

  for (const sig of pattern.signatures) {
    if (combined.includes(sig.toLowerCase())) {
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;

  // Base confidence from signature match ratio (weighted so even 1 match is meaningful)
  const ratio = matchCount / pattern.signatures.length;
  // A single match gives at least 0.6 base confidence, scaling up with more matches
  return Math.min(1, 0.6 + ratio * 0.4);
}

/**
 * Check which best-practice rules are violated by a prompt.
 */
function checkBestPracticeViolations(promptText) {
  const violations = [];
  const lower = promptText.toLowerCase();
  const wordCount = promptText.split(/\s+/).length;

  // Check for role definition
  if (!lower.includes("you are") && !lower.includes("role:") && !lower.includes("acting as")) {
    violations.push("Missing role definition — prompt does not specify the agent's role");
  }

  // Check for context
  if (!lower.includes("context:") && !lower.includes("working with") && !lower.includes("using")) {
    violations.push("Missing explicit context — no technology, environment, or state described");
  }

  // Check for output format
  if (
    !lower.includes("return") &&
    !lower.includes("output") &&
    !lower.includes("format") &&
    !lower.includes("respond with")
  ) {
    violations.push("No output format specified — agent may return unexpected structure");
  }

  // Check for constraints
  if (
    !lower.includes("constraint") &&
    !lower.includes("must") &&
    !lower.includes("do not") &&
    !lower.includes("limit") &&
    !lower.includes("require")
  ) {
    violations.push("No constraints defined — agent has no boundaries on behavior");
  }

  // Check for error handling
  if (
    !lower.includes("error") &&
    !lower.includes("fail") &&
    !lower.includes("on failure") &&
    !lower.includes("if something goes wrong")
  ) {
    violations.push("No error handling instructions — agent won't know how to handle failures");
  }

  // Check for vague language
  const vagueTerms = ["appropriately", "good", "well", "properly", "correctly", "nice", "better"];
  const foundVague = vagueTerms.filter((term) => lower.includes(term));
  if (foundVague.length > 0) {
    violations.push(`Uses vague language: "${foundVague.join('", "')}" — replace with specific criteria`);
  }

  // Check for prompt length issues
  if (wordCount < 10) {
    violations.push("Prompt is too short — likely missing critical details");
  }
  if (wordCount > 500) {
    violations.push("Prompt is very long — consider breaking into smaller tasks");
  }

  return violations;
}

/**
 * Analyze a single prompt and return detected patterns and violations.
 *
 * @param {object} input - { prompt, error, agentType, context }
 * @param {object} options - { minConfidence, maxPatternsPerPrompt, includeSolutions }
 * @returns {object} Analysis result
 */
function analyzePrompt(input, options = {}) {
  const { prompt: promptText, error = "", agentType = "general", context = "" } = input;
  const { minConfidence = 0.6, maxPatternsPerPrompt = 5, includeSolutions = true } = options;

  const failurePatterns = loadFailurePatterns();

  // Match against failure patterns
  const matches = [];
  for (const [key, pattern] of Object.entries(failurePatterns)) {
    const confidence = calculateConfidence(pattern, promptText, `${error} ${context}`);
    if (confidence >= minConfidence) {
      const match = {
        pattern: key,
        name: pattern.name,
        confidence: Math.round(confidence * 100) / 100,
        severity: pattern.severity,
        root_causes: pattern.root_causes,
      };
      if (includeSolutions) {
        match.solutions = pattern.solutions;
      }
      matches.push(match);
    }
  }

  // Sort by confidence descending, limit to max
  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatches = matches.slice(0, maxPatternsPerPrompt);

  // Check best practices
  const violations = checkBestPracticeViolations(promptText);

  return {
    prompt_length: promptText.length,
    word_count: promptText.split(/\s+/).length,
    agent_type: agentType,
    patterns_found: topMatches,
    best_practice_violations: violations,
    overall_quality: calculateQualityScore(topMatches, violations),
  };
}

/**
 * Calculate an overall quality score for the prompt (0-100).
 * Higher is better (fewer issues).
 */
function calculateQualityScore(patterns, violations) {
  let score = 100;

  // Deduct for failure patterns
  for (const p of patterns) {
    const severityPenalty = { critical: 25, high: 15, medium: 10, low: 5 };
    score -= (severityPenalty[p.severity] || 10) * p.confidence;
  }

  // Deduct for best practice violations
  score -= violations.length * 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Analyze a batch of prompts.
 *
 * @param {Array} prompts - Array of { id, prompt, error, agentType, context }
 * @param {object} options - Analysis options
 * @returns {object} Batch analysis result
 */
function analyzeBatch(prompts, options = {}) {
  const results = prompts.map((p) => ({
    id: p.id,
    ...analyzePrompt(p, options),
  }));

  const avgQuality = results.reduce((sum, r) => sum + r.overall_quality, 0) / results.length;

  return {
    total_prompts: results.length,
    average_quality: Math.round(avgQuality),
    results,
  };
}

module.exports = {
  analyzePrompt,
  analyzeBatch,
  checkBestPracticeViolations,
  calculateConfidence,
  loadFailurePatterns,
  loadBestPractices,
};
