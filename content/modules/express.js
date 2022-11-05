import { checkLogin } from './common/auth';
import { form } from './common/data';
import { injectScript } from './common/utils';

import { sleep } from '../../common';

async function scrape(items) {
  let result = form;

  let thumnails = [];

  if (items.imageModule) {
    thumnails = items.imageModule.imagePathList;

    try {
      result['videoUrl'] = " https://video.aliexpress-media.com/play/u/ae_sg_item/" + items.imageModule.videoUid + "/p/1/e/6/t/10301/" + items.imageModule.videoId.toString() + ".mp4";
    } catch (e) {
      console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
    }
  }

  try {
    for (let i in thumnails) {
      try {
        let image = /^https?:/.test(thumnails[i]) ? thumnails[i] : "http:" + thumnails[i]

        result['imageThumbnails'].push(image);
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log(e);
  }

  try {
    for (let i in items.skuModule.productSKUPropertyList) {
      let skus = items.skuModule.productSKUPropertyList[i];

      for (let j in skus.skuPropertyValues) {
        try {
          let imagePath = skus.skuPropertyValues[j].skuPropertyImagePath;

          if (imagePath) {
            let image = /^https?:/.test(imagePath) ? imagePath : "http:" + imagePath;

            result['imageOptions'].push(image);
          }
        } catch (e) {
          console.log(e);

          continue;
        }
      }
    }
  } catch (e) {
    console.log(e);
  }

  let desc_resp = await fetch(items.descriptionModule.descriptionUrl);
  let desc_text = await desc_resp.text();
  let desc_html = new DOMParser().parseFromString(desc_text, "text/html");

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

  return result;
}

export class express {
  constructor() {
    checkLogin('express').then((auth) => {
      if (!auth) {
        return null;
      }
    });
  }

  async get() {
    sessionStorage.removeItem("trg-express-item");

    injectScript('express');

    let timeout = 0;

    while (true) {
      if (timeout === 10) {
        return { 
          code: "ERROR",
          message: "알리익스프레스 접속상태가 원활하지 않습니다.\n잠시 후 다시시도해주세요." 
        };
      }

      let data = sessionStorage.getItem('trg-express-item');

      if (data) {
        let originalData = JSON.parse(data);

        return await scrape(originalData);
      }

      timeout++;

      await sleep(1000 * 1);
    }
  }
}
