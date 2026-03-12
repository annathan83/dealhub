import path from 'path';
import fs from 'fs';

const TEST_DATA_DIR = path.join(__dirname, '../../test-data');

/**
 * Load a single listing from test-data/listings/.
 * @param id - File id with or without prefix, e.g. "001", "listing_001", "1"
 */
export function loadListing(id: string | number): { listingText: string; listingId: string } {
  const raw = String(id).replace(/^listing_/i, '').padStart(3, '0');
  const filename = raw.length <= 3 ? `listing_${raw}.txt` : `${raw}.txt`;
  const filePath = path.join(TEST_DATA_DIR, 'listings', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test data not found: ${filePath}`);
  }
  const listingText = fs.readFileSync(filePath, 'utf-8');
  return { listingText, listingId: filename.replace('.txt', '') };
}

export type MultiFileDealExpected = {
  deal_number: number;
  industry: string;
  location: string;
  broker_name?: string;
  broker_firm?: string;
  broker_phone?: string;
  listing: { asking_price: number; revenue: number; sde: number; multiple?: number };
  email?: { asking_price?: number; revenue?: number; sde?: number };
  financials?: { revenue_ttm?: number; sde_ttm?: number; [k: string]: number | undefined };
  expected_conflicts?: { revenue?: boolean; sde?: boolean; price?: boolean };
  notes?: string;
};

export type MultiFileDealData = {
  listingText: string;
  emailText: string;
  financialsText: string;
  expected: MultiFileDealExpected;
  dealId: string;
};

/**
 * Load a multi-file deal from test-data/multi-file-deals/deal-XXX/.
 * @param id - Deal folder id, e.g. "001", "1", "deal-001"
 */
export function loadMultiFileDeal(id: string | number): MultiFileDealData {
  const raw = String(id).replace(/^deal-?/i, '').padStart(3, '0');
  const folder = `deal-${raw}`;
  const dir = path.join(TEST_DATA_DIR, 'multi-file-deals', folder);
  if (!fs.existsSync(dir)) {
    throw new Error(`Test data not found: ${dir}`);
  }
  const listingText = fs.readFileSync(path.join(dir, 'listing.txt'), 'utf-8');
  const emailText = fs.readFileSync(path.join(dir, 'email.txt'), 'utf-8');
  const financialsText = fs.readFileSync(path.join(dir, 'financials.txt'), 'utf-8');
  const expected: MultiFileDealExpected = JSON.parse(
    fs.readFileSync(path.join(dir, 'expected.json'), 'utf-8')
  );
  return { listingText, emailText, financialsText, expected, dealId: folder };
}

/** NDA file id to signed flag (from test-data/README.md). */
const NDA_SIGNED: Record<string, boolean> = {
  nda_01_signed_docusign: true,
  nda_02_signed_wet: true,
  nda_03_signed_electronic: true,
  nda_04_unsigned_blank: false,
  nda_05_unsigned_template: false,
  nda_06_signed_executed: true,
  nda_07_unsigned_partial: false,
  nda_08_signed_countersigned: true,
  nda_09_unsigned_draft: false,
  nda_10_signed_adobe: true,
};

export type NdaData = {
  content: string;
  signed: boolean;
  fileId: string;
};

/**
 * Load an NDA document from test-data/nda/.
 * @param id - File id, e.g. "nda_01_signed_docusign", "01", "1"
 */
export function loadNda(id: string | number): NdaData {
  let fileId: string;
  if (typeof id === 'number' || /^\d+$/.test(String(id))) {
    const n = String(id).padStart(2, '0');
    const key = Object.keys(NDA_SIGNED).find((k) => k.startsWith(`nda_${n}_`));
    fileId = key ?? `nda_${n}_signed_docusign`;
  } else {
    fileId = String(id).replace(/\.txt$/i, '');
  }
  const filePath = path.join(TEST_DATA_DIR, 'nda', `${fileId}.txt`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test data not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const signed = NDA_SIGNED[fileId] ?? false;
  return { content, signed, fileId };
}
