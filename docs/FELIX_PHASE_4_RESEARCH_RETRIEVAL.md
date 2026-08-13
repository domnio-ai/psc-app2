# Felix Phase 4: Research Retrieval and Citations

**Completed:** 2026-08-03

## Files created

- `../ai-research-service/migrations/002_document_retrieval.sql`
- `../ai-research-service/app/services/document_retrieval.py`
- `../ai-research-service/tests/test_document_retrieval.py`

## Files modified

- `../ai-research-service/app/main.py`
- `../ai-research-service/.env.example`
- `../ai-research-service/requirements.txt`
- `../ai-research-service/README.md`
- `src/api.ts`
- `scripts/index_repository.py`

## Database migration

Migration `002_document_retrieval.sql` adds `indexed_documents`, `document_chunks` and `citation_validations`, plus metadata/full-text indexes. It attempts to enable pgvector and adds an optional vector column when available. The local PostgreSQL installation does not provide the pgvector extension, so the deployed local path uses `REAL[]` embeddings with application cosine scoring and lexical fallback. This compatibility result is explicit; Felix does not claim vector-index acceleration locally.

## Configuration changes

- `OLLAMA_MODEL=qwen2.5:3b`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`
- `FELIX_RETRIEVAL_LIMIT=6`
- `FELIX_CHUNK_SIZE=1800`
- `FELIX_CHUNK_OVERLAP=200`

The `pypdf==5.9.0` dependency was added and installed in the existing Felix virtual environment.

## Retrieval and access controls

Felix first requests document records through the authenticated App2 API. App2 therefore supplies the current user's allowed document set. Database retrieval is restricted with `app2_document_id=ANY(allowed_document_ids)` from that live set; the AI index alone cannot expand visibility. Up to three metadata-ranked visible documents are refreshed per document question, and up to six relevant chunks are returned.

Extracted source content is explicitly marked as untrusted evidence and cannot be treated as instructions. The extraction layer executes no macros, formulas, scripts or repository code. Office archives enforce entry-count and expanded-size limits.

## Citation behavior

Retrieved passages carry title, App2 document ID, version, page where available, section where available, chunk number and source location. Felix is instructed to cite only supplied numbered evidence, distinguish facts/analysis/assumptions/recommendations, state confidence and limitations, identify conflicts, and report insufficient evidence.

Each emitted numeric citation is checked against its passage using a deterministic support score. Results are returned to the client and persisted in `citation_validations`. The validator is deliberately conservative and cannot establish logical entailment; human review remains required for substantial reports.

## Tests

Tests cover:

- TXT and DOCX extraction
- DOCX heading/section preservation
- XLSX worksheet extraction
- PPTX slide extraction
- Provenance-preserving chunking
- Citation-label formatting
- Supported and unsupported claim detection
- Lexical retrieval fallback
- Existing repository scanner and incremental-index behavior

## Security concerns and remaining work

- Scanned or image-only PDFs require a future sandboxed OCR path.
- The local PostgreSQL server lacks pgvector; install the extension before enabling database-native vector search.
- Client-supplied MIME types remain an App2 upload-layer concern identified in Phase 1.
- The citation validator measures passage overlap, not full semantic entailment or source authority.
- Full background indexing, administrator job controls and quality dashboards remain later phases.
- App2 expert mode, code-review mode, approvals and schedules were not started in this phase.

