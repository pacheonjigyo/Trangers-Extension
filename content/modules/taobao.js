import { checkLogin } from './common/auth';
import { form } from './common/data';
import { injectScript } from './common/utils';

import { sleep } from '../../common';

import { Buffer } from 'buffer';

const iconv = require('iconv-lite');

async function scrape(items) {
  let result = form;

  let configs = items.config;

  for (let i in configs.idata.item.auctionImages) {
    try {
      let image = /^https?:/.test(configs.idata.item.auctionImages[i]) ? configs.idata.item.auctionImages[i] : "http:" + configs.idata.item.auctionImages[i];

      result['imageThumbnails'].push(image);
    } catch (e) {
      continue;
    }
  }

  let options = document.querySelectorAll('#J_isku > div ul');

  for (let i in options) {
    try {
      let id = options[i].querySelectorAll('li');

      for (let j in id) {
        try {
          let img = id[j].querySelector('a');
          let url = img.style.backgroundImage.length ? img.style.backgroundImage.match(/(\/\/.*)"/)[1].replace(/_\d{2}x\d{2}.[a-zA-Z]{3}/, "") : "";

          if (url !== "") {
            let image = /^https?:/.test(url) ? url : "http:" + url;

            result['imageOptions'].push(image);
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      continue;
    }
  }

  let desc_html = new DOMParser().parseFromString(items.desc, "text/html");
  let desc = desc_html.querySelectorAll("html > body img");

  for (let i in desc) {
    try {
      if (desc[i].getAttribute('data-ks-lazyload')) {
        desc[i].src = desc[i].getAttribute('data-ks-lazyload');
      }

      if (desc[i].getAttribute('data-src')) {
        desc[i].src = desc[i].getAttribute('data-src');
      }

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
    result['videoUrl'] = "https://cloud.video.taobao.com/play/u/" + items.video.videoOwnerId + "/p/1/e/6/t/1/" + items.video.videoId + ".mp4";
  } catch (e) {
    console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
  }

  return result;
}

export class taobao {
  constructor() {
    checkLogin('taobao').then((auth) => {
      if (!auth) {
        return null;
      }
    });
  }

  async get() {
    sessionStorage.removeItem("trg-taobao-item");

    injectScript('taobao');

    let timeout = 0;

    while (true) {
      if (timeout === 10) {
        return { 
          code: "ERROR",
          message: "타오바오 접속상태가 원활하지 않습니다.\n잠시 후 다시시도해주세요." 
        };
      }

      let data = sessionStorage.getItem('trg-taobao-item');

      if (data) {
        let originalData = JSON.parse(data);

        let descResp = await fetch(originalData.descUrl);
        let descBuffer = await descResp.arrayBuffer();
        let descText = iconv.decode(Buffer.from(descBuffer), 'gbk').toString();

        originalData = {
          ...originalData,

          desc: descText,
        }

        return await scrape(originalData);
      }

      timeout++;

      await sleep(1000 * 1);
    }
  }
}