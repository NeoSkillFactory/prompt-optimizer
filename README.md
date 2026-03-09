# prompt-optimizer

![Audit](https://img.shields.io/badge/audit%3A%20FAIL-red) ![License](https://img.shields.io/badge/license-MIT-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-skill-orange)

> Automate prompt improvement for builder agents to reduce failures and enhance performance.

## Features

- **Failure pattern analysis** — Parses prompt execution logs and matches against known failure signatures (timeout, incomplete output, hallucination, format mismatch, context overflow)
- **Template-based prompt generation** — Applies structured templates for different agent types (db-builder, web-scraper, code-generator, file-processor, api-caller)
- **Batch processing CLI** — Process multiple failed prompts in a single run
- **Metrics tracking** — Track success rates and improvement metrics over time

## Configuration

Runtime settings are stored in `assets/config.yaml`. Key settings:

- `maxVariants` — Maximum prompt variants to generate (default: 3)
- `minConfidence` — Minimum confidence threshold for pattern matches (default: 0.6)
- `defaultAgentType` — Fallback agent type when not specified (default: "general")
- `outputFormat` — Output format: "json" or "text" (default: "json")

## GitHub

Source code: [github.com/NeoSkillFactory/prompt-optimizer](https://github.com/NeoSkillFactory/prompt-optimizer)

**Price suggestion:** $8 USD

## License

MIT © NeoSkillFactory
