import { checkLogin } from './common/auth';
import { form } from './common/data';
import { injectScript } from './common/utils';

import { sleep } from '../../common';

async function scrape(items) {
    let result = form;

    if (items.ipageType === 1) {
        let imgs = document.querySelectorAll('#dt-tab > div > ul img');

        for (let i in imgs) {
            try {
                if (imgs[i].parentNode.getAttribute('class') === "box-img") {
                    let img;

                    if (imgs[i].getAttribute('data-lazy-src')) {
                        img = imgs[i].getAttribute('data-lazy-src').replace(/.[0-9]{2}x[0-9]{2}/, '');
                    } else {
                        img = imgs[i].getAttribute('src').replace(/.[0-9]{2}x[0-9]{2}/, '');
                    }

                    result['imageThumbnails'].push(img);
                }
            } catch (e) {
                continue;
            }
        }

        try {
            for (let i in items.iDetailData.sku.skuProps) {
                let sku_prop = items.iDetailData.sku.skuProps[i];

                for (let j in sku_prop.value) {
                    if (sku_prop.value[j].imageUrl) {
                        result['imageOptions'].push(sku_prop.value[j].imageUrl);
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }

        let desc_data = document.querySelector('#desc-lazyload-container');

        let desc_resp = await fetch(desc_data.getAttribute('data-tfs-url'));
        let desc_text = await desc_resp.text();

        desc_text = desc_text.slice(18, desc_text.length - 1);

        let desc_json = JSON.parse(desc_text);
        let desc_html = new DOMParser().parseFromString(desc_json.content, "text/html");

        let desc_scripts = desc_html.querySelectorAll("script");

        for (let i in desc_scripts) {
            try {
                desc_scripts[i].remove();
            } catch (e) {
                continue;
            }
        }

        let desc = desc_html.querySelectorAll("html > body img");

        for (let i in desc) {
            try {
                if (desc[i].src) {
                    if (desc[i].src.includes(".gif")) {
                        desc[i].parentNode.removeChild(desc[i]);
                    } else {
                        desc[i].src = desc[i].src;
                        result['imageDescriptions'].push(desc[i].src);
                    }
                }
            } catch (e) {
                continue;
            }
        }

        try {
            let video = document.querySelector('#mod-detail-bd > div.detail-v2018-layout-left > div.region-custom.region-detail-gallery.region-takla.ui-sortable.region-vertical > div > div > div');
            let video_data = video.getAttribute('data-mod-config');
            let video_json = JSON.parse(video_data);

            if (video_json.videoId !== "0") {
                result['videoUrl'] = "https://cloud.video.taobao.com/play/u/" + video_json.userId + "/p/1/e/6/t/1/" + video_json.videoId + ".mp4";
            }
        } catch (e) {
            console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
        }
    }

    if (items.ipageType === 2) {
        let subs = JSON.parse(items.offerDomain);

        for (let i in items.iDetailData.images) {
            let img = items.iDetailData.images[i].fullPathImageURI;
            let img_fixed = /^https?:/.test(img) ? img : "http:" + img;

            result['imageThumbnails'].push(img_fixed);
        }

        try {
            for (let i in items.iDetailData.skuModel.skuProps) {
                let sku_prop = items.iDetailData.skuModel.skuProps[i];

                for (let j in sku_prop.value) {
                    if (sku_prop.value[j].imageUrl) {
                        result['imageOptions'].push(sku_prop.value[j].imageUrl);
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }

        let desc_resp = await fetch(subs.offerDetail.detailUrl);
        let desc_text = await desc_resp.text();

        desc_text = desc_text.slice(18, desc_text.length - 1);

        let desc_json = JSON.parse(desc_text);
        let desc_html = new DOMParser().parseFromString(desc_json.content, "text/html");

        let desc_scripts = desc_html.querySelectorAll("script");

        for (let i in desc_scripts) {
            try {
                desc_scripts[i].remove();
            } catch (e) {
                continue;
            }
        }

        let desc = desc_html.querySelectorAll("html > body img");

        for (let i in desc) {
            try {
                if (desc[i].src) {
                    desc[i].src = desc[i].src;
                    result['imageDescriptions'].push(desc[i].src);
                }
            } catch (e) {
                continue;
            }
        }

        try {
            result['videoUrl'] = subs.offerDetail.wirelessVideo.videoUrls.android;
        } catch (e) {
            console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
        }
    }

    return result;
}

export class alibaba {
    constructor() {
        checkLogin('alibaba').then((auth) => {
            if (!auth) {
                return null;
            }
        });
    }

    async get() {
        sessionStorage.removeItem("trg-alibaba-item");

        injectScript('alibaba');

        let timeout = 0;

        while (true) {
            if (timeout === 10) {
                return { 
                    code: "ERROR",
                    message: "1688 접속상태가 원활하지 않습니다.\n잠시 후 다시시도해주세요." 
                };
            }

            let data = sessionStorage.getItem('trg-alibaba-item');

            if (data) {
                let originalData = JSON.parse(data);
                return await scrape(originalData);

            }

            timeout++;

            await sleep(1000 * 1);
        }
    }
}