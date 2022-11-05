function getCookie(cookieName) {
    let cookieValue = "";

    if (document.cookie) {
        let array = document.cookie.split((escape(cookieName) + '='));

        if (array.length >= 2) {
            let arraySub = array[1].split(';');

            cookieValue = unescape(arraySub[0]);
        }
    }

    return cookieValue;
}

async function main() {
    while (true) {
        try {
            let json = {};

            if (window.NEW_DETAIL_ENV) {
                json.pageType = 2;

                sessionStorage.setItem("trg-tmall-item", JSON.stringify(json));

                break;
            } else {
                window.TShop.onProduct(e => {
                    json = {
                        pageType: 1,
                        itemDO: e.__attrVals.itemDO,
                        buyPrice: e.__attrVals.buyPrice,
                        desc: e.__attrVals.desc,
                        propertyPics: e.__attrVals.propertyPics,
                        skuProp: e.__attrVals.skuProp,
                        skuMap: e.__attrVals.skuMap,
                        priceInfo: e.__attrVals.priceInfo,
                        inventory: e.__attrVals.inventory,
                        delivery: e.__attrVals.delivery
                    };

                    console.log(json);
                });

                if (json['itemDO'] && json['buyPrice'] && json['desc'] && json['priceInfo'] && json['inventory']) {
                    sessionStorage.setItem("trg-tmall-item", JSON.stringify(json));

                    break;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.log(e);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();