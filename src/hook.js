const puppeteer = require('puppeteer-extra')
async function initPage(page) {
    if (page.isInitialized) { return; }
    await page.exposeFunction('pptrClick', async (selector) => { await page.click(selector); });
    await page.exposeFunction('pptrType', async (selector, text) => { await page.focus(selector); await page.type(selector, text, {delay: 100}); });
    await page.exposeFunction('pptrKeyboardPress', async (key) => { await page.keyboard.press(key); });
    await page.exposeFunction('pptrSelect', async (selector, value) => { await page.select(selector, value); });
    await page.exposeFunction('pptrWaitForSelector', async (selector, options) => { return await page.waitForSelector(selector, options); });
    await page.exposeFunction('pptrClosePage', async () => { await page.close(); });
    await page.exposeFunction('pptrGoTo', async (url, options) => { await page.goto(url, options); });
    await page.exposeFunction('sendNotification', async (message) => { await sendNotification(message); });
    await page.exposeFunction('pptrExit', async () => { await page.close(); process.exit(0); });
}

const browserURL = 'http://127.0.0.1:3003';
(async () => {
    const browser = await puppeteer.connect({ browserURL });
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            await page.setViewport(null);
            await initPage(page);
        }
    });
})();

