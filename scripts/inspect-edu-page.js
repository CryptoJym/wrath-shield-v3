/**
 * Quick inspection script for education platform login pages
 * Run with: node scripts/inspect-edu-page.js <url>
 */

const { chromium } = require('playwright');

async function inspectPage(url) {
  console.log(`Inspecting ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded:', page.url());
    console.log('Title:', await page.title());

    // Get all form elements
    const forms = await page.$$eval('form', (els) =>
      els.map(e => ({ action: e.action, method: e.method, id: e.id, class: e.className }))
    );
    console.log('\nForms:', JSON.stringify(forms, null, 2));

    // Get all inputs
    const inputs = await page.$$eval('input', (els) =>
      els.map(e => ({ type: e.type, name: e.name, id: e.id, placeholder: e.placeholder, class: e.className }))
    );
    console.log('\nInputs:', JSON.stringify(inputs, null, 2));

    // Get all buttons/links
    const buttons = await page.$$eval('button, a[role="button"], input[type="submit"], a.btn, a[href*="login"], a[href*="signin"]', (els) =>
      els.map(e => ({
        tag: e.tagName,
        text: e.textContent?.trim().substring(0, 50),
        class: e.className,
        id: e.id,
        href: e.href || ''
      }))
    );
    console.log('\nButtons/Links:', JSON.stringify(buttons, null, 2));

    // Look for iframes
    const iframes = await page.$$eval('iframe', (els) =>
      els.map(e => ({ src: e.src, id: e.id, class: e.className }))
    );
    if (iframes.length > 0) {
      console.log('\nIframes:', JSON.stringify(iframes, null, 2));
    }

    // Take screenshot
    const filename = url.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    await page.screenshot({ path: `/tmp/${filename}.png`, fullPage: true });
    console.log(`\nScreenshot saved: /tmp/${filename}.png`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2] || 'https://www.lexiacore5.com';
inspectPage(url);
