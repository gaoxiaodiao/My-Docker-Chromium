const puppeteer = require('puppeteer');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const yargs = require('yargs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const loadScript = async (page, source, isRemote = false) => {
    const script = isRemote ? (await axios.get(source)).data : fs.readFileSync(source, 'utf8');
    console.log('load script:', script);
    await page.evaluate(script => eval(script), script);
};

const loadCookies = async (page, source, isRemote = false) => {
    const cookies = isRemote ? (await axios.get(source)).data : JSON.parse(fs.readFileSync(source, 'utf8'));
    console.log('load cookies:', cookies);
    for (const cookie of cookies) {
        await page.setCookie(cookie);
    }
};


const sendNotification = async (message) => {
    const { NOTIFY_TELEGRAM_TOKEN: token, NOTIFY_TELEGRAM_CHAT_ID: chatId } = process.env;
    if (!token || !chatId) return console.log('Notification config missing');
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const { data } = await axios.post(url, { chat_id: chatId, text: message });
        console.log(data);
    } catch (error) {
        console.error('Notification Error:', error);
    }
};

const initPage = async (page) => {
    if (page.isInitialized) return;
    const actions = {
        pptrClick: selector => page.click(selector),
        pptrType: (selector, text) => page.type(selector, text),
        pptrWaitForSelector: (selector, options) => page.waitForSelector(selector, options),
        pptrClosePage: () => page.close(),
        pptrGoTo: (url, options) => page.goto(url, options),
        sendNotification,
        pptrExit: () => { page.close(); process.exit(0); }
    };
    for (const [name, func] of Object.entries(actions)) {
        await page.exposeFunction(name, func);
    }
    page.isInitialized = true;
};

const checkChromeReady = async (url) => {
    try {
        const { status } = await axios.get(url);
        return status === 200;
    } catch {
        console.error(`Cannot connect to ${url}`);
        return false;
    }
};

const killChromiumProcesses = async () => {
    await new Promise(resolve => spawn('sudo', ['pkill', '-9', 'chromium']).on('close', resolve));
    await new Promise(resolve => spawn('sudo', ['rm', '-f',
        '/tmp/profile/SingletonCookie',
        '/tmp/profile/SingletonLock',
        '/tmp/profile/SingletonSocket'
    ]).on('close', resolve));
};

const startChromium_new = () => {
    const chromeArgs = process.env.CHROME_CLI.split(' ');
    const args = [
        '-u',
        'abc',
        '/usr/bin/wrapped-chromium',
        ...chromeArgs,
    ];
    console.log(args);
    const proc = spawn('sudo', args, { stdio: 'pipe' });
    proc.on('error', err => console.error('Failed to start Chromium:', err));
    proc.on('exit', (code, signal) => console.log(`Chromium exited with code: ${code}, signal: ${signal}`));
    return proc;
};

// const startChromium_old = () => {
//     const args = ['--remote-debugging-port=3003', '--user-data-dir=/tmp/profile'];
//     const proc = spawn('/usr/bin/chromium', args, { stdio: 'pipe' });
//     proc.on('error', err => console.error('Failed to start Chromium:', err));
//     proc.on('exit', (code, signal) => console.log(`Chromium exited with code: ${code}, signal: ${signal}`));
//     return proc;
// };

const startChromium = () => {
    return startChromium_new();
};

const waitChromeReady = async (url) => {
    let retries = 0;
    let proc = null;
    const tryConnect = async () => {
        if (await checkChromeReady(url)) return proc;
        if (++retries > 5) {
            await killChromiumProcesses();
            proc = startChromium();
            retries = 0;
        }
        await sleep(1000);
        return tryConnect();
    };

    return tryConnect();
};

(async () => {
    const argv = yargs
        .option('start-url', { alias: 's', type: 'string', demandOption: true} )
        .option('local-script', { alias: 'ls', type: 'string' })
        .option('remote-script', { alias: 'rs', type: 'string' })
        .option('remote-cookies', { alias: 'rc', type: 'string' })
        .option('local-cookies', { alias: 'lc', type: 'string' })
        .check(args => {
            if (!args.localScript && !args.remoteScript) throw new Error('Provide --local-script or --remote-script');
            if (args.localScript && typeof args.localScript !== 'string') throw new Error('--local-script must be a string');
            if (args.remoteScript && typeof args.remoteScript !== 'string') throw new Error('--remote-script must be a string');
            if (args.startUrl && typeof args.startUrl !== 'string') throw new Error('--start-url must be a string');
            if (args.remoteCookies && typeof args.remoteCookies !== 'string') throw new Error('--remote-cookies must be a string');
            if (args.localCookies && typeof args.localCookies !== 'string') throw new Error('--local-cookies must be a string');
            return true;
        })
        .help().argv;
    try {
        const browserURL = 'http://127.0.0.1:3003';
        await waitChromeReady(browserURL);
        const browser = await puppeteer.connect({ browserURL });
        browser.on('targetcreated', async target => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                await newPage.setViewport(null);
            }
        });

        // close all existing pages
        const pages = await browser.pages();
        for (const page of pages) {
            await page.close();
        }

        const page = await browser.newPage();
        // must init page before goto, otherwise it will encounter a invaild context error
        await initPage(page);
        if (argv.remoteCookies) {
            console.log(`Loading remote cookies: ${argv.remoteCookies}`);
            await loadCookies(page, argv.remoteCookies, true);
        } else if (argv.localCookies) {
            console.log(`Loading local cookies: ${argv.localCookies}`);
            await loadCookies(page, argv.localCookies);
        }
        try {
            await page.goto(argv['start-url'], { waitUntil: 'networkidle2' });
        } catch (error) {
            console.error('Error during goto:', error);
        }

        if (argv.remoteScript) {
            console.log(`Loading remote script: ${argv.remoteScript}`);
            await loadScript(page, argv.remoteScript, true);
        } else if (argv.localScript) {
            console.log(`Loading local script: ${argv.localScript}`);
            await loadScript(page, argv.localScript);
        }
        console.log('Script loaded successfully.');
    } catch (error) {
        console.error('Error during browser setup:', error);
    }
})();