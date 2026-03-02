#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { analyzePrompt, analyzeBatch } = require("./analyzer");
const { optimizePrompt, optimizeBatch } = require("./optimizer");

const SKILL_ROOT = path.resolve(__dirname, "..");

/**
 * Load config from assets/config.yaml.
 */
function loadConfig() {
  const configPath = path.join(SKILL_ROOT, "assets", "config.yaml");
  return yaml.load(fs.readFileSync(configPath, "utf-8"));
}

/**
 * Parse CLI arguments into a structured object.
 */
function parseArgs(argv) {
  const args = {
    action: null,
    prompt: null,
    file: null,
    output: null,
    agentType: null,
    variants: null,
    help: false,
  };

  const raw = argv.slice(2);

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--prompt") {
      args.prompt = raw[++i];
    } else if (arg === "--file") {
      args.file = raw[++i];
    } else if (arg === "--output") {
      args.output = raw[++i];
    } else if (arg === "--agent-type") {
      args.agentType = raw[++i];
    } else if (arg === "--variants") {
      args.variants = parseInt(raw[++i], 10);
    } else if (!arg.startsWith("-") && !args.action) {
      args.action = arg;
    }
  }

  return args;
}

/**
 * Print usage information.
 */
function printHelp() {
  console.log(`
prompt-optimizer — Automate prompt improvement for builder agents

Usage:
  node scripts/main.js <action> [options]

Actions:
  analyze     Identify failure patterns in prompts
  optimize    Generate optimized prompt alternatives
  batch       Process multiple prompts from a JSON file

Options:
  --prompt <text>       Inline prompt text to process
  --file <path>         Path to JSON file with prompts
  --output <dir>        Output directory for batch results
  --agent-type <type>   Target agent type (db-builder, web-scraper, code-generator, file-processor, api-caller, general)
  --variants <n>        Number of variants to generate (default: 3)
  --help, -h            Show this help message

Examples:
  node scripts/main.js analyze --prompt "Build a table"
  node scripts/main.js optimize --prompt "Build a table" --agent-type db-builder
  node scripts/main.js batch --file assets/test-prompts.json --output ./optimized
`.trim());
}

/**
 * Handle the "analyze" action.
 */
function handleAnalyze(args, config) {
  if (!args.prompt && !args.file) {
    console.error("Error: --prompt or --file is required for analyze action");
    process.exit(1);
  }

  const options = {
    minConfidence: config.minConfidence,
    maxPatternsPerPrompt: config.analysis.maxPatternsPerPrompt,
    includeSolutions: config.analysis.includeSolutions,
  };

  if (args.prompt) {
    const input = {
      prompt: args.prompt,
      agentType: args.agentType || config.defaultAgentType,
      error: "",
      context: "",
    };
    const result = analyzePrompt(input, options);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const prompts = JSON.parse(fs.readFileSync(args.file, "utf-8"));
    const result = analyzeBatch(prompts, options);
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Handle the "optimize" action.
 */
function handleOptimize(args, config) {
  if (!args.prompt && !args.file) {
    console.error("Error: --prompt or --file is required for optimize action");
    process.exit(1);
  }

  const options = {
    maxVariants: args.variants || config.maxVariants,
    minConfidence: config.minConfidence,
    includeOriginal: config.optimization.includeOriginal,
  };

  if (args.prompt) {
    const input = {
      prompt: args.prompt,
      agentType: args.agentType || config.defaultAgentType,
      error: "",
      context: "",
    };
    const result = optimizePrompt(input, options);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const prompts = JSON.parse(fs.readFileSync(args.file, "utf-8"));
    const result = optimizeBatch(prompts, options);
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Handle the "batch" action.
 */
function handleBatch(args, config) {
  if (!args.file) {
    console.error("Error: --file is required for batch action");
    process.exit(1);
  }

  const outputDir = args.output || path.join(SKILL_ROOT, "assets", "sample-output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prompts = JSON.parse(fs.readFileSync(args.file, "utf-8"));
  const options = {
    maxVariants: args.variants || config.maxVariants,
    minConfidence: config.minConfidence,
    includeOriginal: config.optimization.includeOriginal,
  };

  const batchResult = optimizeBatch(prompts, options);

  // Write individual results
  for (const result of batchResult.results) {
    const filename = `optimized-${result.id || "unknown"}.json`;
    const outPath = path.join(outputDir, filename);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  }

  // Write summary
  const summaryPath = path.join(outputDir, "batch-summary.json");
  const summary = {
    total_prompts: batchResult.total_prompts,
    average_quality_before: batchResult.average_quality_before,
    output_directory: outputDir,
    files_written: batchResult.results.map((r) => `optimized-${r.id || "unknown"}.json`),
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Main entry point.
 */
function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.action) {
    printHelp();
    if (!args.action && !args.help) {
      process.exit(1);
    }
    return;
  }

  const config = loadConfig();

  switch (args.action) {
    case "analyze":
      handleAnalyze(args, config);
      break;
    case "optimize":
      handleOptimize(args, config);
      break;
    case "batch":
      handleBatch(args, config);
      break;
    default:
      console.error(`Error: Unknown action "${args.action}". Use --help for usage.`);
      process.exit(1);
  }
}

main();
