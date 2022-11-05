import { checkLogin } from './common/auth';
import { form } from './common/data';
import { injectScript } from './common/utils';

import { sleep } from '../../common';

async function scrape(items) {
  let result = form;

  let imgs = document.querySelectorAll('#thumblist img');

  for (let i in imgs) {
    try {
      let img = imgs[i].getAttribute('big');

      if (img) {
        let img_fixed = /^https?:/.test(img) ? img : "http:" + img;

        result['imageThumbnails'].push(img_fixed);
      }
    } catch (e) {
      continue;
    }
  }

  try {
    let colorIds = items.colorId.split(",");

    for (let i in colorIds) {
      if (items.colorPics[i]) {
        let image = /^https?:/.test(items.colorPics[i]) ? items.colorPics[i] : "http:" + items.colorPics[i];

        result['imageOptions'].push(image);
      }
    }
  } catch (e) {
    console.log(e);
  }

  let desc_html = new DOMParser().parseFromString(items.descriptions, "text/html");
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
    result['videoUrl'] = /^https?:/.test(items.video) ? items.video : "https:" + items.video;
  } catch (e) {
    console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
  }

  return result;
}

export class vvic {
  constructor() {
    checkLogin('vvic').then((auth) => {
      if (!auth) {
        return null;
      }
    });
  }

  async get() {
    sessionStorage.removeItem("trg-vvic-item");

    injectScript('vvic');

    let timeout = 0;

    while (true) {
      if (timeout === 10) {
        return { 
          code: "ERROR",
          message: "VVIC 접속상태가 원활하지 않습니다.\n잠시 후 다시시도해주세요." 
        };
      }

      let data = sessionStorage.getItem('trg-vvic-item');

      if (data) {
        let originalData = JSON.parse(data);

        return await scrape(originalData);
      }

      timeout++;

      await sleep(1000 * 1);
    }
  }
}
