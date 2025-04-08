const puppeteer = require('puppeteer-extra')
const axios = require('axios');
const { spawn } = require('child_process');
const yargs = require('yargs');
let pluginHook = null;
try {
    pluginHook = require('../plugins/hook.js');
} catch (error) {
    console.error('Error loading pluginHook:', error);
}

async function changeFingerprint(page) {
    if (pluginHook) {
        await pluginHook.changeFingerprint(page);
    }
}

async function loadLocalScript(page, scriptPath) {
    const fs = require('fs');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    await page.evaluate(script => { eval(script); }, scriptContent);
}

async function sendNotification(message) {
    if (process.env.NOTIFY_TELEGRAM_TOKEN && process.env.NOTIFY_TELEGRAM_CHAT_ID) {
        const token = process.env.NOTIFY_TELEGRAM_TOKEN;
        const chatId = process.env.NOTIFY_TELEGRAM_CHAT_ID;
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        try {
            const response = await axios.post(url, {
                chat_id: chatId,
                text: message
            });
            console.log(response.data);
        } catch (error) {
            console.error('Error:', error);
        }
    } else {
        console.log('Notification not sent because NOTIFY_TELEGRAM_TOKEN or NOTIFY_TELEGRAM_CHAT_ID is not set');
    }
}

async function loadRemoteScript(page, scriptUrl) {
    const scriptContent = await axios.get(scriptUrl);
    await page.evaluate(script => { eval(script); }, scriptContent);
}

async function initPage(page) {
    if (page.isInitialized) { return; }
    await page.exposeFunction('pptrClick', async (selector) => { await page.click(selector); });
    await page.exposeFunction('pptrType', async (selector, text) => { await page.type(selector, text); });
    await page.exposeFunction('pptrWaitForSelector', async (selector, options) => { return await page.waitForSelector(selector, options); });
    await page.exposeFunction('pptrClosePage', async () => { await page.close(); });
    await page.exposeFunction('pptrGoTo', async (url, options) => { await page.goto(url, options); });
    await page.exposeFunction('sendNotification', async (message) => { await sendNotification(message); });
    await page.exposeFunction('pptrExit', async () => { await page.close(); process.exit(0); });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkChromeIsReady(browserURL) {
    try {
        const response = await axios.get(browserURL);
        return response.status === 200;
    } catch (err) {
        console.error(`can't connect to ${browserURL}`)
    }
}

async function waitChromeReady(browserURL) {
    let count = 0;
    let chromiumProcess = null;

    const tryCheckChrome = async () => {
        if (await checkChromeIsReady(browserURL)) {
            console.log('Chromium is ready.');
            return chromiumProcess;
        }

        if (count > 5) {
            console.log('Attempting to kill existing Chromium processes...');
            const pkill = spawn('sudo', ['/usr/bin/pkill', '-9', 'chromium']);
            await new Promise(resolve => pkill.on('close', resolve));

            const rm = spawn("sudo", ["/usr/bin/rm", "-f", "/tmp/profile/SingletonCookie", "/tmp/profile/SingletonLock", "/tmp/profile/SingletonSocket"]);
            rm.on('error', (err) => {
                console.error('Failed to start rm:', err);
            });
            rm.on('exit', (code, signal) => {
                console.log(`rm process exited with code: ${code}, signal: ${signal}`);
            });
            await new Promise(resolve => rm.on('close', resolve));

            console.log('Starting a new Chromium instance...');
            chromiumProcess = spawn('/usr/bin/wrapped-chromium', ["--no-sandbox", "--remote-debugging-port=3003", "--user-data-dir=/tmp/profile"], { stdio: 'pipe' });
            chromiumProcess.on('error', (err) => {
                console.error('Failed to start Chromium:', err);
            });
            chromiumProcess.on('close', (code, signal) => {
                console.log(`Chromium process closed with code: ${code}, signal: ${signal}`);
            });
            chromiumProcess.on('exit', (code, signal) => {
                console.log(`Chromium process exited with code: ${code}, signal: ${signal}`);
            });
            // Reset count to allow time for the new Chromium instance to start
            count = 0;
        }
        count++;
        await sleep(1000); // Wait 1 second before the next check
        return tryCheckChrome(); // Recursive call
    };

    return tryCheckChrome();
}

(async () => {
    const argv = yargs
        .option('local', {
            alias: 'l',
            type: 'string',
            description: 'Path to the local plugin script',
        })
        .option('remote', {
            alias: 'r',
            type: 'string',
            description: 'URL of the remote plugin script',
        })
        .option('start-url', {
            alias: 's',
            type: 'string',
            description: 'Start URL for the browser',
            demandOption: true,
        })
        .check((args) => {
            if (!args.local && !args.remote) {
                throw new Error('You must provide either --local <path> or --remote <url>.');
            }
            if (args.local && typeof args.local !== 'string') {
                throw new Error('--local must have a valid path.');
            }
            if (args.remote && typeof args.remote !== 'string') {
                throw new Error('--remote must have a valid URL.');
            }
            if (!args['start-url'] || typeof args['start-url'] !== 'string') {
                throw new Error('--start-url must be a valid URL.');
            }
            return true;
        })
        .help()
        .argv;
    const customUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    try {
        const browserURL = 'http://127.0.0.1:3003';
        await waitChromeReady(browserURL);
        console.log("chromium is ready!");
        const browser = await puppeteer.connect({ browserURL });
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const page = await target.page();
                await page.setViewport(null);
                await page.setUserAgent(customUA);
                await changeFingerprint(page);
                console.log(`Set User-Agent: ${customUA}`);
            }
        });
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await changeFingerprint(page);
        if (argv['start-url']) {
            console.log(`Navigating to ${argv['start-url']}`);
            await page.goto(argv['start-url'], { waitUntil: 'networkidle2' });
        } else {
            console.error('No start URL provided, skipping start URL loading, you can set START_URL to load a start URL');
            process.exit(1);
        }
        await initPage(page);
        let pluginScriptPath = null;
        if (argv['remote']) {
            console.log(`Loading remote plugin script from ${argv['remote']}`);
            pluginScriptPath = argv['remote'];
            await loadRemoteScript(page, argv['remote']);
        } else if (argv['local']) {
            console.log(`Loading local plugin script from ${argv['local']}`);
            pluginScriptPath = argv['local'];
            await loadLocalScript(page, argv['local']);
        } else {
            console.error('No plugin script path or URL provided, skipping plugin script loading, you can set LOCAL_PLUGIN_SCRIPT_PATH or REMOTE_PLUGIN_SCRIPT_URL to load a plugin script');
            process.exit(1);
        }
        console.log(`${pluginScriptPath} loaded!`);
    } catch (error) {
        console.error('Error connecting to the browser:', error);
    }
})();