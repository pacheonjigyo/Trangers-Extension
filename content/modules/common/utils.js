async function injectScript(type) {
    sessionStorage.removeItem(`${type}-item`);

    let oldScript = document.getElementById('sellforyou');

    if (oldScript) {
        oldScript.remove();
    }

    let script = document.createElement("script");

    script.id = 'sellforyou';

    switch (type) {
        case "taobao": {
            script.src = chrome.runtime.getURL('/resources/taobao.js');

            break;
        }

        case "tmall": {
            script.src = chrome.runtime.getURL('/resources/tmall.js');

            break;
        }

        case "express": {
            script.src = chrome.runtime.getURL('/resources/express.js');

            break;
        }

        case "alibaba": {
            script.src = chrome.runtime.getURL('/resources/alibaba.js');

            break;
        }

        case "vvic": {
            script.src = chrome.runtime.getURL('/resources/vvic.js');

            break;
        }

        default: break;
    }

    document.documentElement.appendChild(script);
}

export {
    injectScript
}