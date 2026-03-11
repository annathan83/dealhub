# DealHub Test Data

Realistic fake business acquisition documents for stress-testing the AI fact extraction system.

Generated with a fixed random seed (42) so results are reproducible.

## Structure

```
test-data/
  listings/           200 plain-text business listings
  broker-emails/       50 broker email threads
  pdf-extractions/     40 simulated OCR-extracted CIM texts
  financials/          20 multi-year P&L tables
  nda/                 10 NDA documents (signed and unsigned)
  multi-file-deals/    20 deal folders, each with 4 files + ground truth
  generate.ps1         Generator script (PowerShell)
  README.md            This file
```

Total: **400 files**

---

## Listings (`listings/`)

200 files covering 20 industries across 10 Florida cities.

**Five format styles, randomly assigned:**

| Style | Description | Extraction challenge |
|---|---|---|
| 0 — Clean | Fully structured with labeled fields | Baseline — should extract perfectly |
| 1 — Semi-structured | Abbreviated labels, informal numbers | `Rev: ~$1.2M`, `Owner benefit: $350k` |
| 2 — Messy broker text | Informal prose, no consistent labels | `sde`, `cashflow`, `net to owner` all used |
| 3 — Missing fields | 1 of 3 key fields replaced with TBD/NDA | `Asking Price: TBD -- contact broker` |
| 4 — Conflicting | Header numbers differ from body text | Tests conflict detection |

**Industries:** Childcare Center, Landscaping, Medical Spa, Auto Repair, Staffing Agency, HVAC, Commercial Cleaning, Logistics, Pizza Restaurant, Dental Practice, Plumbing, IT Managed Services, Pool Service, Insurance Agency, Laundromat, Tutoring Center, Pest Control, Physical Therapy, E-Commerce, Electrical Contractor

**Locations:** Miami, Fort Lauderdale, Boca Raton, Tampa, Orlando, Naples, Jacksonville, Sarasota, West Palm Beach, Clearwater (all FL)

**Number ranges:**
- Revenue: $400K – $4M
- SDE: ~10–25% of revenue
- Price: 1.5x – 3x SDE

---

## Broker Emails (`broker-emails/`)

50 email-format files with broker name, phone, email address, and deal numbers.

~50% of emails intentionally contain numbers that differ from what a listing would show (simulating the broker updating TTM figures). The discrepancy is typically 5–15%.

**Four email styles:** formal introduction, quick summary, conversational pitch, informal text-style.

---

## PDF Extractions (`pdf-extractions/`)

40 files simulating text extracted from scanned PDFs via OCR.

**OCR errors applied (randomly, 2–5 per file):**

| Original | OCR corruption |
|---|---|
| Revenue | Revenu3 |
| Seller | Sell3r |
| Earnings | Earn1ngs |
| Discretionary | D1scret1onary |
| Financial | F1nanc1al |
| Business | Bus1ness |
| Annual | Annua1 |
| Total | T0tal |
| Income | lncome |
| Operating | 0perat1ng |
| Summary | Sumrnary |
| Transfer | Transf3r |

**Additional table corruption:** ~50% of files have comma separators removed from numbers (`1,342,433` → `1 342 433`) and misaligned table columns.

---

## Financials (`financials/`)

20 files with 3–4 year P&L tables.

**Three formats:**
- Full 4-year P&L (2021–2024) with revenue, COGS, gross profit, opex, SDE, and margins
- Simple 3-year table with YoY growth calculations
- Recast P&L with addback detail (owner salary, depreciation, one-time items)

All figures are unaudited seller-prepared numbers, as is typical in SMB acquisitions.

---

## NDAs (`nda/`)

10 NDA documents testing the NDA detection logic.

| File | Signed? | Detection signals |
|---|---|---|
| `nda_01_signed_docusign.txt` | Yes | DocuSign Envelope ID, `/s/` signatures, `Status: COMPLETED` |
| `nda_02_signed_wet.txt` | Yes | `[signed]` marks, printed names, execution date |
| `nda_03_signed_electronic.txt` | Yes | Adobe Sign Transaction ID, "electronically signed" |
| `nda_04_unsigned_blank.txt` | No | All signature lines blank `_______` |
| `nda_05_unsigned_template.txt` | No | `[INSERT BUYER NAME]` placeholders |
| `nda_06_signed_executed.txt` | Yes | DocuSign, `Status: COMPLETED` |
| `nda_07_unsigned_partial.txt` | No | Buyer name filled, seller line blank, explicit "not yet countersigned" note |
| `nda_08_signed_countersigned.txt` | Yes | Wet ink, both parties signed |
| `nda_09_unsigned_draft.txt` | No | Template placeholders |
| `nda_10_signed_adobe.txt` | Yes | Adobe Sign Transaction ID |

---

## Multi-File Deals (`multi-file-deals/`)

20 deal folders, each containing 4 files:

```
deal-001/
  listing.txt      -- Original broker listing (source of truth for price/multiple)
  email.txt        -- Broker follow-up email (TTM numbers, often slightly different)
  financials.txt   -- 3-year P&L table (closest to actual books)
  expected.json    -- Ground truth for testing fact reconciliation
```

### Intentional conflicts

Each deal has deliberate number discrepancies across files:

- **Listing vs email:** Revenue typically differs by 5–14%, SDE by 5–14%, price by 3–10%
- **Listing vs financials:** Revenue differs by 1–6%, SDE by 1–6%
- **All three sources** may disagree on the same fact

The `expected.json` file records:
- The exact value from each source
- Which facts have conflicts (`expected_conflicts.revenue/sde/price`)
- The percentage discrepancy

### Using expected.json for tests

```json
{
  "listing": { "asking_price": 1660177, "revenue": 3772954, "sde": 769161 },
  "email":   { "asking_price": 1592938, "revenue": 3786987, "sde": 713564 },
  "financials": { "revenue_ttm": 3871525, "sde_ttm": 784836 },
  "expected_conflicts": { "revenue": true, "sde": true, "price": true }
}
```

The AI extraction system should:
1. Extract facts from each file independently
2. Detect that revenue/SDE/price have conflicting values across sources
3. Surface the conflict for user resolution rather than silently picking one value

---

## Regenerating

```powershell
cd test-data
powershell -ExecutionPolicy Bypass -File generate.ps1
```

The generator uses a fixed seed (`$rng = New-Object System.Random 42`) so output is deterministic. Change the seed to get a different dataset.
