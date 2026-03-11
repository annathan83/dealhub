import { test, expect } from '../fixtures';

/**
 * Basic upload workflow: add note or file, verify timeline and workspace update.
 * Uses seededDeal fixture (authenticated deal).
 */
test.describe('Upload workflow', () => {
  // requireAuth is called inside the seededDeal fixture
  const NOTE_CONTENT = 'E2E upload test note — $500K asking, HVAC.';

  test('add note, timeline updates, item appears in workspace, page stable', async ({
    page,
    seededDeal,
  }) => {
    const { dealId, dealName } = seededDeal;

    await page.goto(`/deals/${dealId}`);
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();

    // Quick-add bar and workspace visible
    await expect(page.getByTestId('upload-file-button')).toBeVisible();
    await expect(page.getByTestId('add-note-button')).toBeVisible();
    await expect(page.getByTestId('activity-timeline')).toBeVisible();

    // Initial state: timeline has "Deal created"
    const timeline = page.getByTestId('activity-timeline');
    await expect(timeline).toContainText(/1 event/);

    // Add note
    await page.getByTestId('add-note-button').click();
    await expect(page.getByTestId('note-content')).toBeVisible();
    await page.getByTestId('note-content').fill(NOTE_CONTENT);
    await page.getByTestId('note-save').click();

    // Timeline updates (Deal created + Note added = 2 events)
    await expect(timeline).toContainText(/2 events/, { timeout: 15000 });

    // New item appears in workspace
    await expect(page.getByTestId('workspace-file-list')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('workspace-file-row').first()).toBeVisible();
    await expect(page.getByTestId('workspace-file-list')).toContainText(/Note|E2E upload/i);

    // Page stable: still on deal page, no crash
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByTestId('activity-timeline')).toBeVisible();
  });
});
