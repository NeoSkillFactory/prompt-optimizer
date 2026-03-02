#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { analyzePrompt } = require("./analyzer");

const SKILL_ROOT = path.resolve(__dirname, "..");

/**
 * Load prompt templates from references.
 */
function loadTemplates() {
  const filePath = path.join(SKILL_ROOT, "references", "templates.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Select the best template for a given agent type.
 * Falls back to "general" if the specific type is not found.
 */
function selectTemplate(agentType) {
  const templates = loadTemplates();
  return templates[agentType] || templates["general"];
}

/**
 * Generate an optimized prompt variant from a template and analysis.
 */
function generateVariant(template, analysis, input, variantIndex) {
  const { prompt: originalPrompt, context = "", agentType = "general" } = input;
  const structure = template.structure;

  // Build the role section
  let role = structure.role;

  // Build context section with actual context
  let contextSection = structure.context
    .replace("{context_description}", context || "No additional context provided")
    .replace("{database_type}", extractDetail(context, "database") || "the target database")
    .replace("{schema_description}", extractDetail(context, "schema") || "the required schema")
    .replace("{url_pattern}", extractDetail(context, "url") || "the target URL")
    .replace("{data_format}", extractDetail(context, "format") || "structured data")
    .replace("{language}", extractDetail(context, "language") || "the target language")
    .replace("{framework}", extractDetail(context, "framework") || "the project framework")
    .replace("{project_context}", context || "the current project")
    .replace("{input_format}", extractDetail(context, "input") || "the input format")
    .replace("{output_format}", extractDetail(context, "output") || "the output format")
    .replace("{file_size}", extractDetail(context, "size") || "variable size")
    .replace("{base_url}", extractDetail(context, "url") || "the API endpoint")
    .replace("{auth_type}", extractDetail(context, "auth") || "as configured")
    .replace("{rate_limit}", extractDetail(context, "rate") || "respect rate limits");

  // Build task section using original prompt intent
  let taskSection = structure.task.replace("{task_description}", originalPrompt);

  // Build constraints from template + failure-specific fixes
  let constraints = [...structure.constraints];

  // Add fixes based on detected failure patterns
  for (const pattern of analysis.patterns_found) {
    if (pattern.solutions && pattern.solutions.length > 0) {
      // Pick a solution based on variant index for diversity
      const solutionIdx = variantIndex % pattern.solutions.length;
      const fix = pattern.solutions[solutionIdx];
      if (!constraints.includes(fix)) {
        constraints.push(fix);
      }
    }
  }

  // Build output format section
  let outputFormat = structure.output_format;

  // Compose the full prompt with different styles per variant
  const styles = [buildStructuredPrompt, buildConcisePrompt, buildDetailedPrompt];
  const styleFn = styles[variantIndex % styles.length];

  return styleFn(role, contextSection, taskSection, constraints, outputFormat);
}

/**
 * Build a structured prompt with clear section headers.
 */
function buildStructuredPrompt(role, context, task, constraints, outputFormat) {
  const parts = [role, "", `Context: ${context}`, "", `Task: ${task}`, "", "Constraints:"];

  for (const c of constraints) {
    parts.push(`- ${c}`);
  }

  parts.push("", `Output Format: ${outputFormat}`);

  return parts.join("\n");
}

/**
 * Build a concise prompt focusing on essentials.
 */
function buildConcisePrompt(role, context, task, constraints, outputFormat) {
  const constraintStr = constraints.slice(0, 4).join(". ") + ".";
  return `${role}\n\n${context}\n\nTask: ${task}\n\nRules: ${constraintStr}\n\nReturn: ${outputFormat}`;
}

/**
 * Build a detailed prompt with examples and explicit error handling.
 */
function buildDetailedPrompt(role, context, task, constraints, outputFormat) {
  const parts = [
    role,
    "",
    "## Context",
    context,
    "",
    "## Task",
    task,
    "",
    "## Requirements",
  ];

  constraints.forEach((c, i) => {
    parts.push(`${i + 1}. ${c}`);
  });

  parts.push(
    "",
    "## Expected Output",
    outputFormat,
    "",
    "## Error Handling",
    'If you encounter an error, return: {"error": "<description>", "code": "<error_type>"}',
    "Do not return partial results. Either complete the full task or report the error."
  );

  return parts.join("\n");
}

/**
 * Extract a detail from context text based on a keyword hint.
 */
function extractDetail(context, keyword) {
  if (!context) return null;
  const lower = context.toLowerCase();
  const kwLower = keyword.toLowerCase();

  // Try to find a sentence containing the keyword
  const sentences = context.split(/[.,;]+/).map((s) => s.trim());
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(kwLower)) {
      return sentence;
    }
  }
  return null;
}

/**
 * Optimize a single prompt: analyze it, then generate improved variants.
 *
 * @param {object} input - { id, prompt, error, agentType, context }
 * @param {object} options - { maxVariants, minConfidence, includeOriginal }
 * @returns {object} Optimization result
 */
function optimizePrompt(input, options = {}) {
  const { maxVariants = 3, minConfidence = 0.6, includeOriginal = true } = options;

  // Analyze the prompt first
  const analysis = analyzePrompt(input, { minConfidence });

  // Select the appropriate template
  const template = selectTemplate(input.agentType || "general");

  // Generate variants
  const variants = [];
  for (let i = 0; i < maxVariants; i++) {
    const optimizedText = generateVariant(template, analysis, input, i);
    variants.push({
      variant: i + 1,
      prompt: optimizedText,
    });
  }

  const result = {
    id: input.id || null,
    analysis,
    optimized_variants: variants,
  };

  if (includeOriginal) {
    result.original_prompt = input.prompt;
  }

  return result;
}

/**
 * Optimize a batch of prompts.
 *
 * @param {Array} prompts - Array of prompt objects
 * @param {object} options - Optimization options
 * @returns {object} Batch optimization result
 */
function optimizeBatch(prompts, options = {}) {
  const results = prompts.map((p) => optimizePrompt(p, options));
  const avgQuality = results.reduce((sum, r) => sum + r.analysis.overall_quality, 0) / results.length;

  return {
    total_prompts: results.length,
    average_quality_before: Math.round(avgQuality),
    results,
  };
}

module.exports = {
  optimizePrompt,
  optimizeBatch,
  selectTemplate,
  generateVariant,
  loadTemplates,
};
