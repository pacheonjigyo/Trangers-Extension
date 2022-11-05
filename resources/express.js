async function main() {
    while (true) {
        try {
            let json = {
                shippingModule: window.runParams.data.shippingModule,
                commonModule: window.runParams.data.commonModule,
                descriptionModule: window.runParams.data.descriptionModule,
                imageModule: window.runParams.data.imageModule,
                pageModule: window.runParams.data.pageModule,
                priceModule: window.runParams.data.priceModule,
                quantityModule: window.runParams.data.quantityModule,
                skuModule: window.runParams.data.skuModule,
                titleModule: window.runParams.data.titleModule
            };

            console.log(json);

            if (json['shippingModule'] && json['commonModule'] && json['descriptionModule'] && json['imageModule'] && json['pageModule'] && json['priceModule'] && json['quantityModule'] && json['titleModule']) {
                sessionStorage.setItem("trg-express-item", JSON.stringify(json));

                break;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.log(e);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();