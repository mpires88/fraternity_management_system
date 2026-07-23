import { expect, type Page, test } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL ?? 'officer@test.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'password123'
const BASE = '/sigma-nu/epsilon-theta/chapter'
const BUDGET_TITLE = `E2E Budget ${Date.now()}`

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 })

  const chapterLink = page.locator('a, button', { hasText: 'Chapter' }).first()
  if (await chapterLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await chapterLink.click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
  }
}

async function ensureProposalExpanded(page: Page) {
  const addLineItem = page.locator('text=+ Add line item')
  const visible = await addLineItem.isVisible().catch(() => false)
  if (!visible) {
    await page.click('button:has-text("General")')
    await expect(addLineItem).toBeVisible({ timeout: 10_000 })
  }
}

test.describe('Budget flow', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let budgetId: string

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    // Approve/ratify/archive confirm through native dialogs — accept them all
    page.on('dialog', (dialog) => dialog.accept())
    await login(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('budget list page loads', async () => {
    await page.goto(`${BASE}/budget`)
    await expect(page.locator('h1, h2, h3').filter({ hasText: 'Budget' }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('create a new budget', async () => {
    await page.goto(`${BASE}/budget`)
    await page.waitForTimeout(2_000)

    await page.click('button:has-text("Create Budget")')
    await page.fill('#b-title', BUDGET_TITLE)
    await page.selectOption('#b-mode', 'approver')
    await page.click('button[type="submit"]:has-text("Create")')

    const budgetLink = page.locator('a', { hasText: BUDGET_TITLE }).last()
    await expect(budgetLink).toBeVisible({ timeout: 20_000 })

    const href = await budgetLink.getAttribute('href')
    expect(href).toBeTruthy()
    budgetId = href?.split('/budget/')[1]?.split(/[?#]/)[0] ?? ''
    expect(budgetId).toBeTruthy()

    await page.goto(`${BASE}/budget/${budgetId}`)
    await expect(page.locator('text=Drafting')).toBeVisible({ timeout: 10_000 })
  })

  test('add a proposal', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await expect(page.locator('text=Drafting')).toBeVisible({ timeout: 10_000 })

    await page.click('text=+ Add proposal')
    await page.click('button[type="submit"]:has-text("Add Proposal")')

    await expect(page.locator('button:has-text("General")')).toBeVisible({ timeout: 10_000 })
  })

  test('add line items to proposal', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    await ensureProposalExpanded(page)

    // Add first line item
    await page.click('text=+ Add line item')
    const lineForm = page.locator('form', { has: page.locator('input[placeholder="Description"]') })
    await lineForm.locator('input[placeholder="Description"]').fill('Office Supplies')
    await lineForm.locator('input[placeholder="Category"]').fill('Operations')
    await lineForm.locator('input[placeholder="0.00"]').fill('150.00')
    await lineForm.locator('button:has-text("Add")').click()
    await expect(page.locator('td:has-text("Office Supplies")')).toBeVisible({ timeout: 10_000 })

    // Add second line item
    await page.click('text=+ Add line item')
    const lineForm2 = page.locator('form', {
      has: page.locator('input[placeholder="Description"]'),
    })
    await lineForm2.locator('input[placeholder="Description"]').fill('Software License')
    await lineForm2.locator('input[placeholder="Category"]').fill('Technology')
    await lineForm2.locator('input[placeholder="0.00"]').fill('250.00')
    await lineForm2.locator('button:has-text("Add")').click()
    await expect(page.locator('td:has-text("Software License")')).toBeVisible({ timeout: 10_000 })
  })

  test('grand total reflects line items', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    // Grand total in the summary card (first matching element)
    await expect(page.locator('text=$400.00').first()).toBeVisible({ timeout: 10_000 })
  })

  test('edit a line item', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)
    await ensureProposalExpanded(page)

    const displayRow = page.locator('tr', { hasText: 'Office Supplies' })
    await expect(displayRow).toBeVisible({ timeout: 5_000 })
    await displayRow.locator('button:has-text("Edit")').click()

    const amountInput = page.locator('input[type="number"][step="0.01"]')
    await expect(amountInput).toBeVisible({ timeout: 5_000 })
    await amountInput.fill('175.00')

    const saveBtn = page.locator('button:has-text("Save")')
    await expect(saveBtn).toBeVisible({ timeout: 5_000 })
    await saveBtn.click()

    // Check for error display or success
    await page.waitForTimeout(3_000)
    const errorEl = page.locator('[data-testid="action-error"]')
    if (await errorEl.isVisible().catch(() => false)) {
      const errorText = await errorEl.textContent()
      console.error(`updateLineItem error: ${errorText}`)
    }
    await expect(page.locator('text=$175.00').first()).toBeVisible({ timeout: 10_000 })
  })

  test('delete a line item', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)
    await ensureProposalExpanded(page)

    const row = page.locator('tr', { hasText: 'Software License' })
    await expect(row).toBeVisible({ timeout: 5_000 })
    await row.locator('button:has-text("Delete")').click()

    await expect(page.locator('td:has-text("Software License")')).not.toBeVisible({
      timeout: 10_000,
    })
  })

  test('submit a proposal', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    // Expand the proposal
    const proposalBtn = page.locator('button:has-text("General")')
    await expect(proposalBtn).toBeVisible({ timeout: 10_000 })
    const submitBtn = page.locator('button', { hasText: /^Submit$/ })
    if (!(await submitBtn.isVisible().catch(() => false))) {
      await proposalBtn.click()
      await page.waitForTimeout(1_000)
    }

    await expect(submitBtn).toBeVisible({ timeout: 10_000 })
    await submitBtn.click()

    // Wait for Submit button to disappear (action complete + re-render)
    await expect(submitBtn).not.toBeVisible({ timeout: 30_000 })

    // Verify via page reload
    await page.goto(`${BASE}/budget/${budgetId}`)
    await expect(page.locator('span').filter({ hasText: /^submitted$/ })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('return a proposal and resubmit it (revise loop)', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    const proposalBtn = page.locator('button:has-text("General")')
    await expect(proposalBtn).toBeVisible({ timeout: 10_000 })
    const returnBtn = page.locator('button', { hasText: /^Return$/ })
    if (!(await returnBtn.isVisible().catch(() => false))) {
      await proposalBtn.click()
      await page.waitForTimeout(1_000)
    }

    // Treasurer returns the submitted proposal with a note
    await expect(returnBtn).toBeVisible({ timeout: 10_000 })
    await returnBtn.click()
    await page.fill('textarea[id^="return-note-"]', 'E2E: trim this by $50')
    await page.click('button:has-text("Return to Holder")')

    await expect(page.locator('span').filter({ hasText: /^returned$/ })).toBeVisible({
      timeout: 10_000,
    })

    // The return reason is shown to the holder
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)
    const resubmitBtn = page.locator('button', { hasText: /^Resubmit$/ })
    if (!(await resubmitBtn.isVisible().catch(() => false))) {
      await page.locator('button:has-text("General")').click()
      await page.waitForTimeout(1_000)
    }
    await expect(page.locator('text=trim this by $50')).toBeVisible({ timeout: 10_000 })

    // A returned proposal is resubmittable — the loop must not dead-end
    await expect(resubmitBtn).toBeVisible({ timeout: 10_000 })
    await resubmitBtn.click()
    await expect(resubmitBtn).not.toBeVisible({ timeout: 30_000 })

    await page.goto(`${BASE}/budget/${budgetId}`)
    await expect(page.locator('span').filter({ hasText: /^submitted$/ })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('compile budget for review', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    const compileBtn = page.locator('button:has-text("Compile for Review")')
    await expect(compileBtn).toBeVisible({ timeout: 10_000 })
    await compileBtn.click()

    await expect(page.locator('text=In Review')).toBeVisible({ timeout: 10_000 })
  })

  test('approve budget (approver mode)', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)
    await expect(page.locator('text=In Review')).toBeVisible({ timeout: 5_000 })

    await page.click('button:has-text("Approve")')

    await expect(page.locator('text=Approved')).toBeVisible({ timeout: 10_000 })
    // Approver mode: a manual Ratify control appears after approval
    await expect(page.locator('button:has-text("Ratify Budget")')).toBeVisible()
  })

  test('proposals are read-only after approval', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    // The proposal may be auto-expanded (single proposal). If not, expand it.
    const proposalBtn = page.locator('button:has-text("General")')
    await expect(proposalBtn).toBeVisible({ timeout: 10_000 })

    const lineItem = page.locator('td:has-text("Office Supplies")')
    if (!(await lineItem.isVisible().catch(() => false))) {
      await proposalBtn.click()
      await page.waitForTimeout(1_000)
    }

    // After approval, editing controls should be gone
    await expect(page.locator('text=+ Add line item')).not.toBeVisible()
    await expect(page.locator('button', { hasText: /^Submit$/ })).not.toBeVisible()
    // Verify "Approved" status is shown
    await expect(page.locator('text=Approved')).toBeVisible()
  })

  test('ratify budget (approver mode) and verify read-only', async () => {
    await page.goto(`${BASE}/budget/${budgetId}`)
    await page.waitForTimeout(2_000)

    await page.click('button:has-text("Ratify Budget")')
    await expect(page.locator('text=Ratified')).toBeVisible({ timeout: 10_000 })

    // Ratified budgets are frozen: no manage controls, no line-item editing
    await expect(page.locator('button:has-text("Ratify Budget")')).not.toBeVisible()
    const proposalBtn = page.locator('button:has-text("General")')
    if (await proposalBtn.isVisible().catch(() => false)) {
      await proposalBtn.click()
      await page.waitForTimeout(1_000)
    }
    await expect(page.locator('text=+ Add line item')).not.toBeVisible()
  })

  test('archive budget from list page', async () => {
    await page.goto(`${BASE}/budget`)
    await page.waitForTimeout(2_000)

    const card = page.locator('a', { hasText: BUDGET_TITLE })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.locator('button:has-text("Archive")').click()

    await page.waitForTimeout(3_000)
    await page.goto(`${BASE}/budget`)
    await page.waitForTimeout(2_000)

    await expect(page.locator('summary:has-text("Archived")')).toBeVisible({ timeout: 10_000 })
  })
})
