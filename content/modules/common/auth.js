import { getCookie } from "../../../common";

async function checkLogin(type) {
    switch (type) {
        case "taobao": {
            if (getCookie('lgc')) {
                return true;
            } else {
                alert("타오바오 로그인이 필요합니다.");

                return false;
            }
        }

        case "tmall": {
            if (getCookie('lgc') || getCookie('login')) {
                return true;
            } else {
                alert("티몰 로그인이 필요합니다.");

                return false;
            }
        }

        case "express": {
            if (getCookie('rmb_pp')) {
                if (/^kor/.test(getCookie('site')) && /^KRW/.test(getCookie('c_tp')) && /^KR/.test(getCookie('region')) && /^ko_KR/.test(getCookie('b_locale'))) {
                    return true;
                } else {
                    alert("배송지: Korea, 언어: 한국어, 통화: KRW 설정 후 재시도 바랍니다.");

                    return false;
                }
            } else {
                alert("알리 익스프레스 로그인이 필요합니다.");

                return false;
            }
        }

        case "alibaba": {
            if (getCookie('__cn_logon_id__')) {
                return true;
            } else {
                alert("1688 로그인이 필요합니다.");

                return false;
            }
        }

        case "vvic": {
            let loginResp = await fetch("https://www.vvic.com/apic/loginUserInfo?user_key=&city=gz&cityMarketId=1", {
                "method": "GET",
                "credentials": "include"
            });

            let loginJson = await loginResp.json();

            if (loginJson.code === 200) {
                return true;
            } else {
                alert("VVIC 로그인이 필요합니다.");

                return false;
            }
        }

        default: break;
    }

    return true;
}

export {
    checkLogin
}