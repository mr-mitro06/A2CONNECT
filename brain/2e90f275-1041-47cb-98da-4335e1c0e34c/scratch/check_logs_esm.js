import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER_ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE_ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5173/chat', { waitUntil: 'networkidle0' });
    
    // Wait slightly
    await new Promise(r => setTimeout(r, 3000));
    console.log('Done scanning.');
  } catch (err) {
    console.log('SCRAPER_ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
