import { taobao } from './modules/taobao';
import { tmall } from './modules/tmall';
import { express } from './modules/express';
import { alibaba } from './modules/alibaba';
import { vvic } from './modules/vvic';

async function getContents() {
    const currentUrl = window.location.href;

    if (/item.taobao.com\/item.htm/.test(currentUrl)) {
        return await new taobao().get();
    } else if (/detail.tmall.com/.test(currentUrl) ||
        /chaoshi.detail.tmall.com/.test(currentUrl) ||
        /detail.tmall.hk/.test(currentUrl)) {
        return await new tmall().get();
    } else if (/aliexpress.com\/item/.test(currentUrl)) {
        return await new express().get();
    } else if (/detail.1688.com/.test(currentUrl)) {
        return await new alibaba().get();
    } else if (/www.vvic.com\/item/.test(currentUrl)) {
        return await new vvic().get();
    }

    return null;
}

async function main() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case "scrape": {
                getContents().then(sendResponse);

                return true;
            }

            default: break;
        }
    });
}

main();