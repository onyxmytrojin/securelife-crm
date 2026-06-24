# Iteration & Repair Loops for Claude — SecureLife Extraction

This file documents practical "for-loop" patterns (iterative prompt-repair cycles) used when extracting structured data from messy insurance PDFs. The goal is reliability: if the first pass fails, call targeted repairs rather than blind retries.

## Pattern Overview
- Step 1: Chunk the document into coherent segments (head, policy summary, schedules, endnotes).
- Step 2: Run `EXTRACT` prompt on each chunk to get candidate fields + source text pointers.
- Step 3: Validate candidates against schema (Zod/JSON Schema).
- Step 4: If validation fails, build a `REPAIR` prompt that includes the original candidate, the validation errors, and a short hint where to look.
- Step 5: Re-run extraction limited to failing fields (targeted), up to N attempts.

## Pseudocode (detailed)

```
function robustExtract(docText, schema, maxAttempts=3) {
  chunks = chunkDocument(docText)
  results = {}
  for each chunk in chunks:
    attempt = 0
    while attempt < maxAttempts:
      attempt += 1
      raw = callClaude(EXTRACT_PROMPT(schema), chunk)
      parsed = tryParseJSON(raw)
      errors = validateSchema(parsed, schema)
      if errors.empty:
        results.merge(parsed)
        break
      else:
        repairPrompt = buildRepairPrompt(parsed, errors)
        // augment chunk with inline hints extracted from parsed
        chunk = attachHints(chunk, errors)
        // continue loop to retry only failing fields
    if attempt == maxAttempts and errors.notEmpty:
      results.markPartial(parsed, errors)
  return results
}
```

## Repair Prompt Heuristics
- Be specific about search anchors: keywords near the desired field ("premium", "annual", "sum insured").
- Provide example text snippets showing what a valid value looks like (format examples).
- Ask the model to return both `value` and `source_snippet` (exact substring) and `confidence` (low|med|high).

## Implementation Notes (Node/TS)
- Use `pdf-parse` or `pdfjs-dist` to extract raw text and page offsets.
- Keep chunks small (2–4 paragraphs) and preserve nearby line context (±40 chars) for each candidate.
- Use exponential backoff when re-sending to the LLM to avoid rate limit thrashing.

## Example Repair Prompt (concrete)

System: "You are an extraction assistant. The user previously returned: `{ \"premium_amount\": \"N/A\" }` and validation flagged `premium_amount` as non-numeric. Look for numeric values near the word 'premium' or 'annual' and return JSON with `premium_amount: {amount: number|null, currency: string|null}, source_snippet: string, confidence: low|med|high`. If you cannot find it, return null and a short note."

## When to Stop Retrying
- Stop after `maxAttempts` (3) or when retries yield identical `errors` and no extra clues were found.
- If repeated failures, escalate: mark `needs_human_review` and store an annotated image/PDF view.

## Logging & Auditing
- Save each attempt's raw response + parsed JSON + validation errors for auditing and model improvement.
- Aggregate common failure modes into a dataset to refine prompts or add specialized regex extractors.

---

Practical tip: use repair loops sparingly for high-value fields (policy_number, premium, dates). For low-value fields, accept null and annotate.
