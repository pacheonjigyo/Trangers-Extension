const urlList = [
    "item.taobao.com",
    "detail.tmall.com",
    "chaoshi.detail.tmall.com",
    "detail.tmall.hk",
    "aliexpress.com/item/",
    "detail.1688.com/",
    "www.vvic.com/item/",
    "www.amazon.com/"
];

async function floatingToast(message, type) {
    let toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.innerHTML = message;

    toastContainer.appendChild(toast);

    await sleep(1000 * 5);

    toast.style.setProperty('-webkit-animation', "fadeout 1s");
    toast.style.setProperty('animation', "fadeout 1s");

    await sleep(1000 * 0.8);

    toast.remove();
}

function getClock() {
    let date = new Date();

    return {
        YY: date.getFullYear().toString(),
        MM: (date.getMonth() + 1).toString().padStart(2, '0'),
        DD: date.getDate().toString().padStart(2, '0'),
        hh: date.getHours().toString().padStart(2, '0'),
        mm: date.getMinutes().toString().padStart(2, '0'),
        ss: date.getSeconds().toString().padStart(2, '0'),

        time: date.getTime()
    };
}

function getCookie(cookieName) {
    let cookieValue = null;

    if (document.cookie) {
        let array = document.cookie.split((escape(cookieName) + '='));

        if (array.length >= 2) {
            let arraySub = array[1].split(';');

            cookieValue = unescape(arraySub[0]);
        }
    }

    return cookieValue;
}

function readFileAsync(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {
    urlList,

    floatingToast,
    getClock,
    getCookie,
    readFileAsync,
    sleep,
}