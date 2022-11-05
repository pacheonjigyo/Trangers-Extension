import { checkLogin } from './common/auth';
import { form } from './common/data';
import { injectScript } from './common/utils';

import { getCookie, sleep } from '../../common';

import CryptoJS from "crypto-js";

async function scrape(items) {
  let result = form;

  if (items.pageType === 1) {
    if (items.propertyPics) {
      let imgs = items.propertyPics.default;

      for (let i in imgs) {
        let image = /^https?:/.test(imgs[i]) ? imgs[i] : "http:" + imgs[i];

        result['imageThumbnails'].push(image);
      }
    } else {
      let imgs = document.querySelectorAll('#J_UlThumb img');

      for (let i in imgs) {
        try {
          let img = imgs[i].getAttribute('src').replace(/_[0-9]{2}x[0-9]{2}q[0-9]{2}.[a-zA-Z]{3}/, '');
          let image = /^https?:/.test(img) ? img : "http:" + img;

          result['imageThumbnails'].push(image);
        } catch (e) {
          console.log(e);
        }
      }
    }

    try {
      for (let i in items.propertyPics) {
        if (i !== 'default') {
          let image = /^https?:/.test(items.propertyPics[i][0]) ? items.propertyPics[i][0] : "http:" + items.propertyPics[i][0];

          result['imageOptions'].push(image);
        }
      }
    } catch (e) {
      console.log(e);
    }

    let desc_html = new DOMParser().parseFromString(items.desc, "text/html");
    let desc = desc_html.querySelectorAll("html > body img");

    for (let i in desc) {
      try {
        if (desc[i].src.includes("spaceball.gif") || desc[i].src.includes("NewGuaLianyingxiao_1startFLag.gif")) {
          desc[i].parentNode.removeChild(desc[i]);
        } else {
          desc[i].src = desc[i].src;
          result['imageDescriptions'].push(desc[i].src);
        }
      } catch (e) {
        continue;
      }
    }

    try {
      let video = items.itemDO.imgVedioUrl.replace(/(\/\/cloud\.video\.taobao\.com\/play\/u\/\d+\/p\/\d+\/e\/)\d+(\/t\/)\d+(.+)swf/, "$16$21$3mp4");

      result['videoUrl'] = /^https?:/.test(video) ? video : "https:" + video;
    } catch (e) {
      console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
    }
  } else {
    const params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });

    const appKey = "12574478";

    const tokenFull = getCookie('_m_h5_tk');
    const token = tokenFull.split("_")[0];

    const time = new Date().getTime();

    const data = `{\"id\":\"${params.id}\",\"detail_v\":\"3.3.2\",\"exParams\":\"{\\\"queryParams\\\":\\\"id=${params.id}\\\",\\\"id\\\":\\\"${params.id}\\\"}\"}`;

    const text = token + "&" + time + "&" + appKey + "&" + data;
    const sign = CryptoJS.MD5(text).toString();

    const dataUrl = `https://h5api.m.tmall.com/h5/mtop.taobao.pcdetail.data.get/1.0/?jsv=2.6.1&appKey=${appKey}&t=${time}&sign=${sign}&api=mtop.taobao.pcdetail.data.get&v=1.0&ttid=2022%40taobao_litepc_9.20.0&isSec=0&ecode=0&AntiFlood=true&AntiCreep=true&H5Request=true&type=json&dataType=json&data=${encodeURI(data)}`;

    let dataResp = await fetch(dataUrl, { "credentials": "include" });
    let dataJson = await dataResp.json();

    let thumnails = dataJson.data.item.images;

    for (let i in thumnails) {
      try {
        result['imageThumbnails'].push(thumnails[i]);
      } catch (e) {
        continue;
      }
    }

    for (let i in dataJson.data.skuBase.props) {
      for (let j in dataJson.data.skuBase.props[i].values) {
        if (dataJson.data.skuBase.props[i].values[j].image) {
          const image = /^https?:/.test(dataJson.data.skuBase.props[i].values[j].image) ? dataJson.data.skuBase.props[i].values[j].image : "http:" + dataJson.data.skuBase.props[i].values[j].image;

          result['imageOptions'].push(image);
        }
      }
    }

    let desc_html = document.getElementsByClassName('desc-root')[0];
    let desc = desc_html.querySelectorAll("img");
    let desc_imgs = [];

    for (let i in desc) {
      try {
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
      result['videoUrl'] = dataJson.data.componentsVO.headImageVO.videos[0].url;
    } catch (e) {
      console.log("알림: 동영상이 없는 상품입니다. (", e, ")");
    }
  }

  return result;
}

export class tmall {
  constructor() {
    checkLogin('tmall').then((auth) => {
      if (!auth) {
        return null;
      }
    });
  }

  async get() {
    sessionStorage.removeItem("trg-tmall-item");

    injectScript('tmall');

    let timeout = 0;

    while (true) {
      if (timeout === 10) {
        return { 
          code: "ERROR",
          message: "티몰 접속상태가 원활하지 않습니다.\n잠시 후 다시시도해주세요." 
        };
      }

      let data = sessionStorage.getItem('trg-tmall-item');

      if (data) {
        let originalData = JSON.parse(data);

        return await scrape(originalData);
      }

      timeout++;

      await sleep(1000 * 1);
    }
  }
}