async function main() {
    while (true) {
        try {
            let json = {
                price: g_config.sibRequest.data,
                config: g_config,
                sku: window.Hub.config.get("sku"),
                video: window.Hub.config.get("video"),
                descUrl: g_config.descUrl.split("?")[0]
            };

            sessionStorage.setItem("trg-taobao-item", JSON.stringify(json));

            break;
        } catch (e) {
            console.log(e);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();