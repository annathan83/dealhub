import path from 'path';
import fs from 'fs';

const TESTDATA_DIR = path.join(__dirname, '../../testdata/deals/hvac-clean');

export type HvacCleanExpected = {
  dealName: string;
  expectedFacts: { fact_key: string; label: string }[];
  expectedMissingFacts: string[];
  expectedScoreRange: { min: number; max: number };
};

export type HvacCleanTestData = {
  listingText: string;
  expected: HvacCleanExpected;
};

/**
 * Load hvac-clean golden test data.
 * Use with hvacCleanDeal fixture for scenario tests.
 */
export function loadHvacCleanTestData(): HvacCleanTestData {
  const listingPath = path.join(TESTDATA_DIR, 'listing.txt');
  const expectedPath = path.join(TESTDATA_DIR, 'expected.json');

  const listingText = fs.readFileSync(listingPath, 'utf-8');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8')) as HvacCleanExpected;

  return { listingText, expected };
}
