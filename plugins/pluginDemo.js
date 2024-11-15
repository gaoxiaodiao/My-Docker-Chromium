(async () => {
    console.log('pluginDemo loaded!');

    //type “Hello World!”, then send a notification to Telegram, wait for 10 seconds, and exit.
    await pptrWaitForSelector('textarea[role="combobox"]');
    await pptrClick('textarea[role="combobox"]');
    await pptrType('textarea[role="combobox"]', 'Hello World!');

    sendNotification(`Done!`);
    
    await new Promise(resolve => setTimeout(resolve, 10_000));
    pptrExit();

})();