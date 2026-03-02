# Best Practices for Builder Agent Prompts

## 1. Be Specific About the Role

Bad: "Do this task."
Good: "You are a database builder agent responsible for creating PostgreSQL schemas."

The role sets the context for all subsequent instructions and helps the agent scope its behavior.

## 2. Provide Explicit Context

Always include:
- What technology/tools are involved
- What state the system is currently in
- Any relevant constraints or limitations

Bad: "Build a table."
Good: "Using PostgreSQL 15, create a users table in the 'auth' schema with UUID primary keys."

## 3. Define Output Format Precisely

Agents fail most often when the expected output format is ambiguous.

- Specify JSON keys, types, and structure
- Provide a concrete example of expected output
- State what to return on success vs failure

## 4. Include Error Handling Instructions

Tell the agent what to do when things go wrong:
- What errors to expect
- How to handle each error type
- What to return/report when an error occurs

## 5. Set Boundaries and Constraints

Without constraints, agents may:
- Use deprecated APIs
- Generate overly complex solutions
- Ignore performance considerations
- Skip validation

Always list 3-5 specific constraints.

## 6. Use Structured Prompt Format

Organize prompts into clear sections:
1. **Role** — Who the agent is
2. **Context** — What it's working with
3. **Task** — What to do
4. **Constraints** — What limits apply
5. **Output Format** — What to return

## 7. Avoid Ambiguous Language

- "Handle appropriately" → Specify exactly how
- "Good performance" → Define acceptable thresholds
- "Clean code" → List specific coding standards
- "If needed" → Define the exact conditions

## 8. Set Timeouts and Resource Limits

- Specify maximum execution time
- Define memory or API call limits
- Include chunking strategies for large inputs

## 9. Provide Fallback Behavior

Define what happens when:
- Input is missing or malformed
- External services are unavailable
- The task cannot be completed fully

## 10. Keep Prompts Focused

One prompt should accomplish one task. Split complex workflows into sequential agent calls rather than overloading a single prompt.
