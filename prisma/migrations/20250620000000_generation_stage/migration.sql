-- On-demand generation now reports a fine-grained pipeline phase so the library
-- can show live progress (percentage + current activity). Defaults to 'queued'
-- for new and existing rows.

ALTER TABLE "Generation" ADD COLUMN "stage" TEXT DEFAULT 'queued';
