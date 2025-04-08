
async function changeFingerprint(page) {
    const customUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    await page.evaluateOnNewDocument((customUA) => {
        Object.defineProperty(window.navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', configurable: true });
        Object.defineProperty(navigator, 'userAgent', { get: () => customUA });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(screen, 'width', { get: () => 1512 });
        Object.defineProperty(screen, 'height', { get: () => 982 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 30 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 30 });
        Object.defineProperty(window, 'devicePixelRatio', { get: () => 2 });
    }, customUA);
}

module.exports = {
    changeFingerprint
};