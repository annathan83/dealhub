import { test, expect } from '../fixtures';
import { loadNda } from '../helpers/testData';

/**
 * E2E: NDA detection using test-data/nda/.
 * - Signed NDA: upload or add as note and confirm NDA event/indicator if applicable.
 * - Unsigned NDA: no signed indicator.
 * Current flow: we only assert that we can load NDA content; full NDA detection E2E
 * would require uploading a file to a deal and checking timeline/events (if implemented).
 */

test.describe('Test data — NDA', () => {
  test('loads signed NDA content (nda_01)', () => {
    const { content, signed, fileId } = loadNda('nda_01_signed_docusign');
    expect(signed).toBe(true);
    expect(content.length).toBeGreaterThan(100);
    expect(content.toLowerCase()).toMatch(/confidential|agreement|disclos/);
  });

  test('loads unsigned NDA content (nda_04)', () => {
    const { content, signed, fileId } = loadNda('nda_04_unsigned_blank');
    expect(signed).toBe(false);
    expect(content.length).toBeGreaterThan(50);
  });

  test('loadNda accepts numeric id', () => {
    const { signed } = loadNda(1);
    expect(typeof signed).toBe('boolean');
  });
});
