# Rules Engine Scorecard — Forta Match

**Purpose:** Compare the rules technology **implemented in Forta Match** ([Microsoft RulesEngine](https://github.com/microsoft/RulesEngine) 6.x) with principal alternatives, and document why it is a strong fit for this solution.

**Context (as built today):**

| Aspect | Forta Match implementation |
|--------|---------------------------|
| Stack | .NET 8 API, SQLite, Next.js UI |
| Rule count | ~5 rules per workflow (`ReferralMatch`) |
| Rule storage | JSON in `RuleConfiguration` + default [`rules.json`](../backend/src/Forta.Match.Api/Config/rules.json) |
| Expression style | `LambdaExpression` on `extraction`, `capacity`, `insurer` inputs |
| Operations | Hot-reload on save, test endpoint, live preview (transient engine), visual condition builder |
| Outcome | Aggregated to **JA / TWIJFEL / NEE** with per-rule pass/fail for secretariaat |

**Scoring:** 1 = poor fit · 3 = adequate · 5 = excellent fit for Forta Match  
**Weight:** Reflects priorities for a Dutch GGZ referral triage MVP (care staff, small rule set, .NET monolith, explainability).

---

## Executive summary

| Engine | Weighted score ( / 5.0 ) | Verdict |
|--------|--------------------------|---------|
| **Microsoft RulesEngine** (chosen) | **4.35** | **Best fit** — already integrated, JSON-native, zero extra infrastructure |
| NRules | 3.55 | Strong .NET alternative; heavier model for declarative care-staff editing |
| Custom C# validation | 3.50 | Simplest runtime; worst for configurable, hot-reload rules |
| JsonLogic (+ custom host) | 3.45 | Portable JSON rules; less natural for complex .NET domain types |
| Open Policy Agent (OPA) | 3.15 | Excellent for policy-as-code; operational overhead unjustified here |
| Camunda DMN | 3.10 | Great for decision tables; separate platform and skillset |
| Drools / KIE | 2.85 | Enterprise BRMS; JVM ops and licensing misaligned with stack |
| Azure Logic Apps | 2.75 | Low-code friendly; weak in-process, versioned rule co-location |
| InRule (commercial) | 2.70 | Mature BRMS; cost and vendor lock-in for MVP scale |

---

## Evaluation criteria

| # | Criterion | Weight | Why it matters for Forta |
|---|-----------|--------|--------------------------|
| 1 | .NET integration & same-process execution | 15% | Rules run inside `Forta.Match.Api` on each AI Match; no sidecar service desired |
| 2 | Externalized, hot-reloadable rules | 15% | Secretariaat edits rules in UI; `PUT /api/rules` reloads engine without redeploy |
| 3 | Non-developer configurability | 12% | Visual builder compiles to engine expressions; AI assistant generates rule JSON |
| 4 | Explainability (per-rule pass/fail) | 12% | TWIJFEL/NEE must cite which criterion failed (Exclusion, Location, etc.) |
| 5 | Operational complexity | 10% | Small team; avoid JVM cluster, OPA sidecars, or separate BPM server |
| 6 | License & total cost | 10% | MVP / pilot; prefer OSS or included in existing Azure/.NET footprint |
| 7 | Expressiveness for referral logic | 10% | Age, region OR-list, capacity, insurer, DSM warnings |
| 8 | Authoring & test ergonomics | 8% | Sample JSON test, preview API, Mistral-generated rules |
| 9 | Performance at current scale | 5% | Single referral evaluation; latency dominated by Mistral, not rules |
| 10 | Healthcare / compliance maturity | 3% | No engine is HIPAA/ NEN-certified out of the box; audit = app + logs |

---

## Detailed scorecard

Scores are **1–5** per criterion. **Weighted** = score × weight.

### 1. Microsoft RulesEngine (implemented)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 5 | NuGet `RulesEngine` 6.0; `RulesEngineService` + `LabelMatchingService` |
| Hot-reload | 5 | Rules JSON in DB; `ReloadAsync()` on save |
| Non-developer config | 4 | Visual builder + AI chat; advanced users still see lambdas |
| Explainability | 5 | `ExecuteAllRulesAsync` → rule name, message, pass/fail in API/UI |
| Ops complexity | 5 | In-process library; no extra deployment unit |
| License cost | 5 | MIT (Microsoft open source) |
| Expressiveness | 4 | Lambda C# expressions; sufficient for current 5 rules |
| Authoring & test | 5 | `/test`, `/preview`, rules page, Mistral `GenerateRuleAsync` |
| Performance | 5 | Trivial cost for ~5 rules per referral |
| Healthcare maturity | 3 | Generic engine; compliance is application-level |
| **Weighted total** | **4.35** | |

**Strengths in Forta**

- **Same JSON shape end-to-end:** UI → SQLite → engine → test/preview. No translation layer beyond the visual builder compiler.
- **Fits the “advise, human decides” model:** Engine advises; `BuildRecommendation()` maps failures to JA/TWIJFEL/NEE — business logic stays in [`RulesEngineService.cs`](../backend/src/Forta.Match.Api/Services/RulesEngineService.cs).
- **Aligned with Microsoft stack:** Consistent with .NET 8, optional Azure hosting, and team skills.
- **Low marginal cost:** Adding a rule = JSON array entry + UI card; no new microservice.

**Limitations (acceptable at current scale)**

- Lambda expressions are **developer-oriented** at the metal layer; mitigated by the visual builder and AI assistant.
- No built-in version history or approval workflow (could be added in app/DB).
- Not a full BRMS (no decision tables UI, no RETE inference) — **not required** for deterministic inclusion checks.

---

### 2. NRules

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 5 | Native .NET; fluent DSL or XML |
| Hot-reload | 3 | Typically code-first or compiled assemblies; dynamic reload harder |
| Non-developer config | 2 | Rules as C# DSL; poor match for secretariaat UI |
| Explainability | 4 | Good tracing; setup more complex |
| Ops complexity | 4 | In-process; compilation pipeline |
| License cost | 5 | OSS |
| Expressiveness | 5 | Very powerful forward-chaining |
| Authoring & test | 3 | Unit tests natural; no JSON parity with current UI |
| Performance | 5 | Fast |
| Healthcare maturity | 3 | Generic |
| **Weighted total** | **3.55** | |

**vs RulesEngine:** Better for **complex inference** (many interacting facts); overkill when rules are independent checks on extracted fields.

---

### 3. Custom C# validation (hand-coded `if` / policy classes)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 5 | Native |
| Hot-reload | 1 | Requires redeploy unless custom scripting |
| Non-developer config | 1 | Changes need developers |
| Explainability | 4 | Full control of messages |
| Ops complexity | 5 | Simplest |
| License cost | 5 | None |
| Expressiveness | 5 | Unlimited |
| Authoring & test | 2 | xUnit only; no rules UI |
| Performance | 5 | Fastest |
| Healthcare maturity | 3 | App-owned |
| **Weighted total** | **3.50** | |

**vs RulesEngine:** Best **runtime simplicity**; worst fit for **“Regelconfiguratie”** product goal and AI-generated rules.

---

### 4. JsonLogic (JSON rules + .NET interpreter)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 4 | Via community packages; not first-class Microsoft |
| Hot-reload | 5 | JSON-native |
| Non-developer config | 4 | JSON-friendly; different mental model than lambdas |
| Explainability | 3 | Depends on wrapper implementation |
| Ops complexity | 4 | In-process |
| License cost | 5 | OSS |
| Expressiveness | 3 | Awkward for `Contains`, nullable strings, decimals |
| Authoring & test | 3 | Would rebuild compiler + preview |
| Performance | 4 | Fine at scale |
| Healthcare maturity | 3 | Generic |
| **Weighted total** | **3.45** | |

**vs RulesEngine:** Portable JSON, but Forta already invested in RulesEngine JSON schema and Mistral prompts for that format.

---

### 5. Open Policy Agent (OPA) + Rego

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 3 | HTTP sidecar or embedded; extra moving parts |
| Hot-reload | 4 | Bundle APIs |
| Non-developer config | 2 | Rego is code; not care-staff friendly |
| Explainability | 4 | Good with tooling |
| Ops complexity | 2 | Sidecar, bundles, policies repo |
| License cost | 5 | OSS |
| Expressiveness | 5 | Policy-as-code |
| Authoring & test | 3 | `opa test`; separate pipeline |
| Performance | 4 | Fast |
| Healthcare maturity | 4 | Used in cloud-native compliance |
| **Weighted total** | **3.15** | |

**vs RulesEngine:** Strong for **platform-wide policy** (K8s, API gateway); disproportionate for **5 referral rules** inside one API.

---

### 6. Camunda DMN (decision tables)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 3 | Java-centric; .NET via REST or embedded engine |
| Hot-reload | 4 | Deployment descriptors |
| Non-developer config | 4 | DMN tables approachable for analysts |
| Explainability | 5 | Hit policies, table traces |
| Ops complexity | 2 | Camunda Platform or SaaS |
| License cost | 3 | Community vs enterprise features |
| Expressiveness | 3 | Tables less natural for arbitrary boolean combos |
| Authoring & test | 3 | Modeler desktop app |
| Performance | 4 | Good |
| Healthcare maturity | 4 | Common in care pathways |
| **Weighted total** | **3.10** | |

**vs RulesEngine:** Prefer DMN when rules are **tabular** (score → outcome). Forta rules mix **OR regions**, **AND capacity**, **warnings** — expression model fits better.

---

### 7. Drools / Red Hat Decision Manager (KIE)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 2 | JVM; interop or separate service |
| Hot-reload | 4 | KJAR deployment |
| Non-developer config | 3 | Decision tables in enterprise BRMS |
| Explainability | 5 | Enterprise audit trails |
| Ops complexity | 1 | JVM ops, KIE Server |
| License cost | 2 | Enterprise licensing |
| Expressiveness | 5 | Full BRMS |
| Authoring & test | 3 | Dedicated tooling |
| Performance | 4 | Proven at scale |
| Healthcare maturity | 5 | Widely used in enterprise health |
| **Weighted total** | **2.85** | |

**vs RulesEngine:** Choose Drools for **enterprise BRMS** with dedicated rules teams; Forta is a **focused .NET MVP** with rules edited in-app.

---

### 8. Azure Logic Apps / Power Automate

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 2 | External workflow service |
| Hot-reload | 4 | Designer publish |
| Non-developer config | 5 | Low-code friendly |
| Explainability | 3 | Run history in Azure |
| Ops complexity | 2 | Connectors, identities, environments |
| License cost | 3 | Consumption / per-user |
| Expressiveness | 3 | Good for orchestration; awkward for fine-grained rule sets |
| Authoring & test | 4 | Designer + test triggers |
| Performance | 3 | Network latency per evaluation |
| Healthcare maturity | 4 | Common in Dutch healthcare IT |
| **Weighted total** | **2.75** | |

**vs RulesEngine:** Better for **cross-system workflows** (email, CRM, timers). Forta needs **synchronous in-match evaluation** next to Mistral extraction in one API call.

---

### 9. InRule (commercial .NET BRMS)

| Criterion | Score | Notes |
|-----------|-------|-------|
| .NET integration | 4 | .NET native |
| Hot-reload | 4 | Rule repository |
| Non-developer config | 4 | Business user authoring |
| Explainability | 5 | Trace built-in |
| Ops complexity | 3 | Repository + runtime |
| License cost | 1 | Commercial |
| Expressiveness | 5 | Mature |
| Authoring & test | 4 | Vendor IDE |
| Performance | 4 | Good |
| Healthcare maturity | 4 | Used in insurance/health |
| **Weighted total** | **2.70** | |

**vs RulesEngine:** Pay for maturity when rule count and governance **justify BRMS spend**; premature for Forta’s current scope.

---

## Side-by-side matrix (unweighted averages)

| Engine | .NET | Hot-reload | Care UX | Explain | Ops | Cost | Express | Author | Perf | **Avg** |
|--------|------|------------|---------|---------|-----|------|---------|--------|------|---------|
| **Microsoft RulesEngine** | 5 | 5 | 4 | 5 | 5 | 5 | 4 | 5 | 5 | **4.7** |
| NRules | 5 | 3 | 2 | 4 | 4 | 5 | 5 | 3 | 5 | 3.9 |
| Custom C# | 5 | 1 | 1 | 4 | 5 | 5 | 5 | 2 | 5 | 3.7 |
| JsonLogic | 4 | 5 | 4 | 3 | 4 | 5 | 3 | 3 | 4 | 3.9 |
| OPA | 3 | 4 | 2 | 4 | 2 | 5 | 5 | 3 | 4 | 3.6 |
| Camunda DMN | 3 | 4 | 4 | 5 | 2 | 3 | 3 | 3 | 4 | 3.4 |
| Drools/KIE | 2 | 4 | 3 | 5 | 1 | 2 | 5 | 3 | 4 | 3.2 |
| Logic Apps | 2 | 4 | 5 | 3 | 2 | 3 | 3 | 4 | 3 | 3.2 |
| InRule | 4 | 4 | 4 | 5 | 3 | 1 | 5 | 4 | 4 | 3.8 |

---

## Rationale: why Microsoft RulesEngine is the right fit for Forta Match

### 1. Matches the product architecture

Forta Match is a **single .NET API** that:

1. Extracts referral data (Mistral),
2. Evaluates **a small, named rule set** in-process,
3. Returns an **advisory** recommendation for humans.

RulesEngine executes step 2 with **no additional service**, matching the monolith and SQLite deployment model.

### 2. Matches the rule shape in production

Current rules are **independent boolean gates** on a fixed input model (`extraction`, `capacity`, `insurer`):

```text
ExclusionCriteria  → AND (risk, age)
LocationMatch      → OR  (regions)
CapacityCheck      → AND (slots, wait weeks)
InsurerCoverage    → AND (covered, cap)
DsmSupported       → AND (DSM present) [Warning]
```

This is **not** forward-chaining inference across hundreds of facts (NRules/Drools strength). It is **workflow-style rule lists** — exactly what RulesEngine’s JSON workflows provide.

### 3. Matches the configurability roadmap

The app already delivers:

- JSON persistence and **hot reload** ([`RulesConfigController`](../backend/src/Forta.Match.Api/Controllers/RulesConfigController.cs)),
- **Test** and **preview** against sample referrals,
- **Visual condition builder** (field / operator / value → lambda),
- **Mistral** rule generation targeting RulesEngine JSON.

Switching engines would **invalidate** UI, prompts, and stored configurations for marginal gain.

### 4. Matches explainability requirements

Dutch GGZ secretariaat need to see **which criterion failed** (e.g. “Regio niet in servicegebied”), not a black-box score. RulesEngine returns **per-rule results** that map directly to UI labels (Exclusie, Locatie, Capaciteit, Verzekering, DSM).

### 5. Matches cost and team constraints

- **MIT license**, no per-decision fees.
- **Familiar C# expressions** for developers extending rules.
- **Low ops:** no JVM, no OPA bundle pipeline, no Camunda cluster for ~5 rules.

### 6. Acceptable trade-offs

| Trade-off | Mitigation in Forta |
|-----------|---------------------|
| Lambda syntax is technical | Visual builder + AI assistant + raw JSON tab |
| No built-in rule versioning | Store versions in `RuleConfiguration` / audit table (future) |
| Not a certified medical device | Rules are **advisory**; human validation remains mandatory (product intent) |

---

## When to reconsider

Re-evaluate the engine if Forta grows into:

| Trigger | Consider |
|---------|----------|
| 50+ interdependent rules with inference | NRules or Drools |
| Analyst-owned decision tables only | Camunda DMN |
| Organization-wide policy on many services | OPA |
| Heavy BPM (timers, human tasks, integrations) | Camunda / Logic Apps **orchestration** alongside RulesEngine |
| Enterprise BRMS governance (SOX, multi-tenant rule repos) | InRule / KIE |

Until then, **Microsoft RulesEngine remains the highest-scoring option** for Forta Match’s scope, stack, and UX direction.

---

## References

- [Microsoft RulesEngine (GitHub)](https://github.com/microsoft/RulesEngine)
- Forta implementation: [`RulesEngineService.cs`](../backend/src/Forta.Match.Api/Services/RulesEngineService.cs), [`rules.json`](../backend/src/Forta.Match.Api/Config/rules.json)
- UI: [`frontend/src/app/rules/page.tsx`](../frontend/src/app/rules/page.tsx), [`frontend/src/lib/ruleSchema.ts`](../frontend/src/lib/ruleSchema.ts)

*Document version: 1.0 — aligned with Forta Match codebase (RulesEngine 6.0, ReferralMatch workflow).*
