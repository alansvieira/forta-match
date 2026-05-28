# Forta Match

AI for triage and referral: **AI recommends, humans decide.**

End-to-end solution implementing the Forta Match flow across three phases:

1. **Intake (Secretariat)** — Upload referral letter, register patient, completeness check
2. **AI Match** — Mistral AI extraction + [Microsoft RulesEngine](https://github.com/microsoft/RulesEngine) evaluation
3. **Human Review** — Screening team for uncertain cases; secretariat validation with override

## Stack

| Layer | Technology |
|-------|------------|
| Backend | .NET 8 Web API |
| Rules | Microsoft.RulesEngine 6.x |
| LLM | Mistral AI |
| Database | SQLite + EF Core |
| Frontend | Next.js 14, Tailwind CSS |

## Quick start

### 1. Configure Mistral API key

```bash
# Edit config/.env
MISTRAL_API_KEY=your_key_here
```

Without a key, the backend uses mock LLM extraction for development.

**Sample referral PDF for intake upload tests:** [assets/mock-referral-letter.pdf](assets/mock-referral-letter.pdf) (regenerate with `python scripts/generate_mock_referral_pdf.py` after `pip install fpdf2`).

### 2. Run backend

```bash
cd backend/src/Forta.Match.Api
dotnet run
```

API: http://localhost:5072  
Swagger: http://localhost:5072/swagger

### 3. Run frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:3000

## API overview

| Phase | Endpoints |
|-------|-----------|
| Intake | `POST /api/intake/upload`, `POST /api/intake/register`, `POST /api/intake/{id}/validate` |
| Match | `POST /api/match/{id}/run`, `POST /api/match/{id}/extract`, `POST /api/match/{id}/evaluate` |
| Review | `GET /api/review/queue`, `POST /api/review/{id}/decide`, `POST /api/review/{id}/override` |
| Rules | `GET /api/rules`, `PUT /api/rules/{workflow}`, `POST /api/rules/test` |

## Rules configuration

Default rules live in `backend/src/Forta.Match.Api/Config/rules.json` and are seeded to SQLite on first run. Edit rules via the **Rules** page in the UI or the API; changes hot-reload the engine.

## Principles

- AI advises
- Humans decide
- Matching across labels
- Privacy by design
