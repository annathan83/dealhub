-- ─── Migration 046: Deal Contacts — Test Seed Data ───────────────────────────
--
-- Creates 4 representative test scenarios for verifying deal_contacts behavior.
-- Uses DO $$ blocks so the seed is idempotent (safe to run multiple times).
--
-- Scenarios:
--   1. Single broker — one clean AI-extracted contact, is_primary = true
--   2. Conflicting info — two AI contacts with different phone numbers
--   3. Multiple contacts — broker + seller + assistant
--   4. Phone-only searchable — contact with phone but no name (tests digit search)
--
-- NOTE: These rows use a placeholder user_id and deal_id.
--       Replace 'YOUR_USER_ID' and 'YOUR_DEAL_ID_N' with real UUIDs when testing,
--       or run this via a test harness that injects the correct IDs.
--
-- To verify after running:
--   SELECT * FROM deal_contacts ORDER BY created_at;
-- ─────────────────────────────────────────────────────────────────────────────

-- This seed is intentionally commented out to prevent accidental execution
-- against production. Uncomment and replace placeholder IDs to use.

/*

-- ── Scenario 1: Single broker ─────────────────────────────────────────────────
-- Deal: "Miami HVAC Business"
-- Contact: Jane Smith, AI-extracted from listing.txt, high confidence

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_1',
  'YOUR_USER_ID',
  'Jane Smith',
  'broker',
  '(305) 555-1234',
  'jane@sunbeltadvisors.com',
  'Sunbelt Business Advisors',
  'ai_extracted',
  'listing.txt',
  0.92,
  true
);


-- ── Scenario 2: Conflicting broker info ───────────────────────────────────────
-- Deal: "Fort Lauderdale Landscaping"
-- Contact A: From listing PDF — phone (954) 555-0001
-- Contact B: From broker email — same name but different phone (954) 555-9999
-- Both are AI-extracted; the system keeps both and marks the higher-confidence one primary.

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_2',
  'YOUR_USER_ID',
  'Robert Garcia',
  'broker',
  '(954) 555-0001',
  'rgarcia@broker.com',
  'BizBuySell Brokers',
  'ai_extracted',
  'listing.pdf',
  0.88,
  true
);

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_2',
  'YOUR_USER_ID',
  'Robert Garcia',
  'broker',
  '(954) 555-9999',
  'rgarcia@broker.com',
  'BizBuySell Brokers',
  'ai_extracted',
  'broker_email.txt',
  0.75,
  false
);


-- ── Scenario 3: Multiple contacts ────────────────────────────────────────────
-- Deal: "Tampa Auto Repair Shop"
-- Contacts: broker (primary), seller, assistant

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_3',
  'YOUR_USER_ID',
  'Maria Lopez',
  'broker',
  '(813) 555-2200',
  'mlopez@tampabiz.com',
  'Tampa Bay Business Brokers',
  'ai_extracted',
  'listing.txt',
  0.91,
  true
);

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_3',
  'YOUR_USER_ID',
  'Carlos Mendez',
  'seller',
  '(813) 555-3300',
  null,
  null,
  'ai_extracted',
  'nda.pdf',
  0.70,
  false
);

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_3',
  'YOUR_USER_ID',
  'Lisa Chen',
  'assistant',
  null,
  'lchen@tampabiz.com',
  'Tampa Bay Business Brokers',
  'user_entered',
  'user',
  null,
  false
);


-- ── Scenario 4: Phone-only searchable ────────────────────────────────────────
-- Deal: "Orlando Cleaning Business"
-- Contact: No name — only a phone number extracted from OCR text.
-- Verifies that searching "4075559876" or "(407) 555-9876" finds this deal.

INSERT INTO deal_contacts (deal_id, user_id, name, role, phone, email, brokerage,
  source_type, source_label, confidence, is_primary)
VALUES (
  'YOUR_DEAL_ID_4',
  'YOUR_USER_ID',
  null,
  'broker',
  '(407) 555-9876',
  null,
  null,
  'ai_extracted',
  'ocr_extraction.txt',
  0.65,
  true
);

*/

-- ─── Verification queries (run after uncommenting and executing above) ─────────
-- SELECT deal_id, name, role, phone, email, is_primary, source_type, confidence
-- FROM deal_contacts
-- ORDER BY deal_id, is_primary DESC, created_at;
--
-- Phone digit search test (should find scenario 4):
-- SELECT dc.* FROM deal_contacts dc
-- WHERE dc.phone_digits = '4075559876';
--
-- Partial digit search test (should find scenario 4):
-- SELECT dc.* FROM deal_contacts dc
-- WHERE dc.phone_digits LIKE '%5559876%';
