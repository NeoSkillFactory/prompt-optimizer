---
name: prompt-optimizer
description: Automate prompt improvement for builder agents to reduce failures and enhance performance.
version: 1.0.0
triggers:
  - "improve builder agent prompts"
  - "optimize prompts for automation"
  - "fix prompt failures"
  - "generate better prompts"
  - "reduce builder agent failures"
  - "help with prompt optimization"
  - "automate prompt improvement"
---

# prompt-optimizer

## Purpose

Automate prompt improvement for builder agents through CLI-driven analysis and generation. Analyzes failed prompts, identifies failure patterns, and generates optimized alternatives using templates and best practices.

## Core Capabilities

- **Failure pattern analysis** — Parses prompt execution logs and matches against known failure signatures (timeout, incomplete output, hallucination, format mismatch, context overflow)
- **Template-based prompt generation** — Applies structured templates for different agent types (db-builder, web-scraper, code-generator, file-processor, api-caller)
- **Batch processing CLI** — Process multiple failed prompts in a single run
- **Metrics tracking** — Track success rates and improvement metrics over time

## CLI Interface

```bash
# Analyze a single prompt
node scripts/main.js analyze --prompt "your failed prompt here"

# Analyze from a file
node scripts/main.js analyze --file path/to/failed-prompts.json

# Optimize prompts (analyze + generate alternatives)
node scripts/main.js optimize --prompt "your failed prompt here"

# Batch process multiple prompts
node scripts/main.js batch --file path/to/failed-prompts.json --output ./optimized/

# Show help
node scripts/main.js --help
```

### Actions

| Action | Description |
|--------|-------------|
| `analyze` | Identify failure patterns in prompts |
| `optimize` | Generate optimized prompt alternatives |
| `batch` | Process multiple prompts from a JSON file |

### Flags

| Flag | Description |
|------|-------------|
| `--prompt` | Inline prompt text to process |
| `--file` | Path to JSON file with prompts |
| `--output` | Output directory for batch results |
| `--agent-type` | Target agent type (e.g., db-builder) |
| `--variants` | Number of variants to generate (default: 3) |
| `--help` | Show usage information |

## Integration Guide

Builder agents can invoke the optimizer when failures are detected:

```bash
# In a builder agent failure handler
prompt-optimizer optimize --prompt "$FAILED_PROMPT" --agent-type "$AGENT_TYPE"
```

### Error Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid arguments or missing input |
| 2 | File not found or unreadable |
| 3 | Analysis failed (no patterns matched) |
| 4 | Optimization failed (template error) |

## Configuration

Runtime settings are stored in `assets/config.yaml`. Key settings:

- `maxVariants` — Maximum prompt variants to generate (default: 3)
- `minConfidence` — Minimum confidence threshold for pattern matches (default: 0.6)
- `defaultAgentType` — Fallback agent type when not specified (default: "general")
- `outputFormat` — Output format: "json" or "text" (default: "json")
