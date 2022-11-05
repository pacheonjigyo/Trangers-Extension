async function main() {
    let descResp = await fetch(window.location.href);
    let descText = await descResp.text();
    let descHtml = new DOMParser().parseFromString(descText, "text/html");

    while (true) {
        try {
            let title = document.querySelector('body > div.deatil-wrapper > article > main > section:nth-child(1) > div.detail.product-detail > div.detail-name > h1');

            console.log(title);

            let json = {
                itemVid: ITEM_VID,
                discountPrice: _DISCOUNTPRICE,
                size: _SIZE,
                color: _COLOR,
                colorPics: _COLORPICS === '' ? [] : JSON.parse(_COLORPICS),
                skuMap: _SKUMAP === '' ? [] : JSON.parse(_SKUMAP),
                sizeId: _SIZEID,
                colorId: _COLORID,
                video: _ITEMVIDEO,
                descriptions: descHtml.querySelector('#descTemplate').innerHTML,
                title: title.textContent
            };

            console.log(json);

            sessionStorage.setItem("trg-vvic-item", JSON.stringify(json));

            break;
        } catch (e) {
            console.log(e);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();