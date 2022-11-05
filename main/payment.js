const ENDPOINT_KOOZA = "http://www.sellforyou.co.kr:3001/api/";
const FLASK_URL = "http://www.sellforyou.co.kr:5003/trangers/";

let appData = null;
let props = null;

let documentData = null;

let payType = "1";
let payAmount = 49500;
let payDiscount = 0;
let payWayType = "CASH";

async function payment() {
    let name = payName.value.replaceAll(" ", "");
    let phone = payPhone.value.replace(/[^0-9]/g, "");
    let checked = payAccept.checked;

    if (name.length === 0) {
        alert("입금자명을 입력해주세요.", 'failed');

        return;
    }

    if (phone.length === 0) {
        alert("연락처를 입력해주세요.", 'failed');

        return;
    }

    if(payWayType == "CASH"){
        if (!documentData) {
            alert("사업자등록증이 첨부되지 않았습니다.", 'failed');
    
            return;
        }
    }

    if (!checked) {
        alert("서비스 이용약관에 동의해주세요.", 'failed');

        return;
    }

    const payBody = {
        "email": appData.user.id,
        "password": "sitezero1*",
        "title": "트랜져스 이용 신청서",
        "description": `${payDiscount}`,
        "moment": new Date().toISOString(),
        "visit": 0,
        "comment": "",
        "servicetype": parseInt(payType),
        "user": {
            "name": name,
            "phone": phone,
            "company": documentData
        },
        "etc1": payWayType,
        "etc2": appData.user.refavailable === 1 ? appData.user.refcode : "",
        "etc3": ""
    }

    if (payWayType == "CARD") {
        delete payBody.user.company;
    }
    
    let payResp = await fetch(ENDPOINT_KOOZA + "query", {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        },

        method: "POST",
        body: JSON.stringify(payBody)
    });


    let payText = await payResp.text();

    if (payText === 'OK') {
        let emailBody = {
            type: 'naver',
            to: 'koozapas@naver.com',
            subject: `[트랜져스] 트랜져스 이용 신청서 (${name})`,
            text: '트랜져스 이용 신청서가 접수되었습니다. 위버에서 확인 바랍니다.'
        };

        await fetch(ENDPOINT_KOOZA + "mail", {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },

            method: "POST",
            body: JSON.stringify(emailBody)
        });

        let availableBody = {
            id: appData.user.id,
            available: 0
        };

        let creditBody = {
            id: appData.user.id,
            credit: appData.user.credit - payDiscount
        };
        
        await fetch(FLASK_URL + "setavailable", {
            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify(availableBody),

            method: "POST"
        });

        await fetch(FLASK_URL + "setcredit", {
            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify(creditBody),

            method: "POST"
        });

        alert("결제 신청이 완료되었습니다.", 'success');

        window.close();
    } else {
        alert("결제 신청에 실패하였습니다.", 'success');
    }
}

function readImage(e) {
    const fileList = e.target.files;

    if (fileList.length <= 0) {
        return;
    }

    let reader = new FileReader();

    reader.onload = function (event) {
        payDocumentText.innerText = fileList[0].name;

        documentData = event.target.result;
    };

    reader.readAsDataURL(fileList[0]);
}

function calcPrice() {
    let originalPrice;

    switch (payType) {
        case "1": {
            originalPrice = 49500;

            break;
        }

        case "3": {
            originalPrice = 125400;

            break;
        }

        case "4": {
            originalPrice = 207900;

            break;
        }

        default: break;
    }

    if (originalPrice) {
        payAmount = originalPrice - payDiscount;

        if (payDiscount > 0) {
            payPrice.innerHTML = `
                <span style="color: white;">
                    \\ ${originalPrice.toLocaleString('ko-KR')}
                </span>
                
                - 
                
                <span style="color: gray;">
                    \\ ${payDiscount.toLocaleString('ko-KR')}
                </span> 
                
                = 
                
                <span style="color: coral;">
                    \\ ${payAmount.toLocaleString('ko-KR')}
                </span>
            `;
        } else {
            payPrice.innerHTML = `
                <span style="color: coral;">
                    \\ ${payAmount.toLocaleString('ko-KR')}
                </span>
            `;
        }
    }
}

function paymentMethod() {
    payWay.addEventListener('click', () => {
        if (payWay.value == "cash") {
            payWayType = "CASH";
            license.style.visibility = "";
        } else if (payWay.value == "card") {
            payWayType = "CARD";
            license.style.visibility = "hidden";
        }
    });
}

async function main() {
    // const commonProps = chrome.runtime.getURL('/common.js');

    // props = await import(commonProps);

    let appInfo = localStorage.getItem('appInfo');

    if (appInfo) {
        appData = JSON.parse(appInfo);
    }

    let info = {
        id: appData.user.id,
    };

    let userResp = await fetch(FLASK_URL + "getuser", {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify(info),

        method: "POST"
    });

    let userJson = await userResp.json();

    switch (userJson.status) {
        case "SUCCESS": {
            appData.user.credit = userJson.credit;
            appData.user.limit = userJson.limit;
            appData.user.rank = userJson.rank;
            appData.user.usage = userJson.usage;
            appData.user.available = true;
            appData.user.refcode = userJson.refcode;
            appData.user.refavailable = userJson.available;

            break;
        }

        default: {
            window.location.href = `./login.html`;

            return;
        }
    }

    payCreditTotal.innerText = `\\ ${appData.user.credit.toLocaleString('ko-KR')}`;

    paymentMethod();
    paySubmit.addEventListener('click', payment);
    payDocument.addEventListener('change', readImage);
    payCreditApply.addEventListener('click', () => {
        payDiscount = parseInt(payCredit.value);

        if (isNaN(payDiscount)) {
            alert("적립금은 숫자형태로 입력해주세요.");

            return;
        }

        if (payDiscount > appData.user.credit) {
            alert("적립금이 부족합니다.");

            return;
        }

        calcPrice();
    });

    let payTypeList = document.getElementsByClassName('pay-type');

    for (let i = 0; i < payTypeList.length; i++) {
        payTypeList[i].addEventListener('click', (e) => {
            payType = e.target.getAttribute('value');

            for (let j = 0; j < payTypeList.length; j++) {
                if (payTypeList[j].value === payType) {
                    payTypeList[j].className = "pay-type button inform round";

                    calcPrice();
                } else {
                    payTypeList[j].className = "pay-type button default round";
                }
            }
        });
    }

    calcPrice();
}

main();
