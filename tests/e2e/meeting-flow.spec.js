import { test, expect } from '@playwright/test'

test.describe('회의 생성 플로우', () => {
  test('새 회의록 페이지에 접근할 수 있다', async ({ page }) => {
    // 로그인 (mock)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // 로그인 후 대시보드
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 새 회의록 페이지로 이동
    await page.goto('/meetings/new')
    await expect(page.locator('text=새 회의록')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('챗봇 페이지', () => {
  test('AI 챗봇 페이지에 접근할 수 있다', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=AI 회의 챗봇')).toBeVisible({ timeout: 10000 })
  })
})
