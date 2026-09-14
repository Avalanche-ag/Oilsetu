# AI / NLP scripts (ai.nlp branch, vendored into integration)

Status: **present but unwired**. These are the AI team's standalone scripts, kept here so
the full system lives in one tree. Nothing in `backend/` or `src/` imports them yet.

Contents: report extraction prompt (`prompt.py`, `extractor.py`), schedule matcher
(`matcher.py`), terminology normalizer (`normalizer.py`), end-to-end pipeline
(`pipeline.py`), risk rules (`proactive_intelligence.py`), photo verification
(`visual_verifier.py`, `ai_visual_verification_adaptor.py`), multilingual assistant
(`multilingual_assistant.py`), plus eval/test scripts (`calibrate.py`,
`evaluate_visual_verifier.py`, `test_models.py`, `test_visual_verifier.py`).

To activate (future phase, needs owner approval):
1. `pip install openai pydantic sentence-transformers pandas` (+ torch) and place the
   `data/` files the scripts expect (`01_baseline_schedule.xlsx`,
   `02_daily_progress_report_civil_piping.txt`, `05_terminology_synonym_hints.csv`).
2. Export `GEMINI_API_KEY` for the LLM-backed scripts. Never commit keys or `.env`.
3. Wrap the needed functions in a service module behind the frontend's
   `processReport(rawText, ctx) => PreviewEntry[]` contract and map scores to the
   90/70 confidence bands in `src/config/constants.ts`.

Live matching today comes from `backend/app/matching/` (lexical + optional embeddings),
not from these scripts.
