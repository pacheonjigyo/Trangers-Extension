async function main() {
    while (true) {
        try {
            let json = {
                ipageType: window.iDetailConfig && window.iDetailData ? 1 : window.__STORE_DATA && window.__INIT_DATA ? 2 : 0,
                iDetailConfig: window.iDetailConfig ?? window.__STORE_DATA.globalData,
                iDetailData: window.iDetailData ?? window.__INIT_DATA.globalData,
                offerDomain: window.__STORE_DATA && window.__INIT_DATA ? window.__INIT_DATA.data[1081181309582].data.offerDomain : ""
            };

            if (json['ipageType'] && json['iDetailConfig'] && json['iDetailData']) {
                sessionStorage.setItem("trg-alibaba-item", JSON.stringify(json));

                break;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();