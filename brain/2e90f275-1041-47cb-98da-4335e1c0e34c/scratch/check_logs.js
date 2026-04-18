const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
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
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    
    // Type password and login
    await page.type('input[type="password"]', 'abhi123'); // assuming access code input is a password field
    await page.keyboard.press('Enter');
    
    // wait for redirect to chat
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('Done scanning.');
  } catch (err) {
    console.log('SCRAPER_ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
