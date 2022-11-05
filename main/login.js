import CryptoJS from "crypto-js";

import { sleep } from "../common";

const FLASK_URL = "http://www.sellforyou.co.kr:5003/trangers/";

let appData = null;

let isVerifying = false;

let verifyDigit = null;
let verifyTimer = null;

async function saveUserInfo(info) {
    localStorage.setItem('appInfo', JSON.stringify({
        "user": info,

        "login": true,

        "settings": {
            "autoFillId": autoFillId.checked,
            "autoLogin": autoSignIn.checked,

            "extensionType": "jpeg",
            "waterMarkType": "N",

            "originWidthPCSize": 800,
            "originWidthThumbnailSize": 800,
            "originWidthOptionSize": 800,
            "originWidthDescriptionSize": 800,
            "originSensitive": 0.03
        }
    }));

    window.location.href = "./app.html";
}

async function onSignIn() {
    fetch("https://api.sellforyou.co.kr/graphql");

    signIn.innerHTML = `
        <div class="loading" style="width: 16px; height: 16px;">
        </div>
    `;

    if (!appId.value) {
        alert("아이디를 입력해주세요.");

        signIn.innerHTML = '로그인';

        return;
    }

    if (!appPassword.value) {
        alert("비밀번호를 입력해주세요.");

        signIn.innerHTML = '로그인';

        return;
    }

    let info = {
        id: appId.value,
        pw: appPassword.value
    };

    let loginResp = await fetch(FLASK_URL + "signin", {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify(info),

        method: "POST"
    });

    let loginJson = await loginResp.text();

    await sleep(1000 * 1);

    switch (loginJson) {
        case "SUCCESS": {
            saveUserInfo(info);

            break;
        }

        case "FAILED": {
            alert("아이디 또는 비밀번호가 일치하지 않습니다.");

            break;
        }
    }

    signIn.innerHTML = '로그인';
}

async function onSignUp() {
    if (!signId.value) {
        alert("아이디를 입력해주세요.");

        return;
    }

    if (!signPassword.value) {
        alert("비밀번호를 입력해주세요.");

        return;
    }

    if (signPassword.value !== signPasswordCheck.value) {
        alert("비밀번호가 일치하지 않습니다.");

        return;
    }

    if (!signEmail.value.includes("@")) {
        alert("이메일이 형식에 맞지 않습니다.");

        return;
    }

    if (!signName.value) {
        alert("성명을 입력해주세요.");

        return;
    }

    if (!signPhone.value) {
        alert("연락처를 입력해주세요.");

        return;
    }

    if (!signPhone.disabled) {
        alert("휴대폰 인증을 완료해주세요.");

        return;
    }

    if (!signAccept.checked) {
        alert("서비스 이용약관에 동의해주세요.");

        return;
    }

    if (!signRefCode.disabled || !signRefCode.value) {
        let accept = confirm("추천인코드가 입력되지 않았습니다.\n추천인코드 미입력 시 적립금 혜택을 받으실 수 없습니다.\n회원가입을 진행하시겠습니까?");

        if (!accept) {
            return;
        }
    }

    signSubmit.innerHTML = `
        <div class="loading" style="width: 16px; height: 16px;">
        </div>
    `;

    let date = new Date();

    date.setDate(date.getDate() + 7);

    let YY = date.getFullYear().toString()
    let MM = (date.getMonth() + 1).toString().padStart(2, '0')
    let DD = date.getDate().toString().padStart(2, '0')

    let info = {
        id: signId.value,
        pw: signPassword.value,

        servicetype: "",
        servicerank: "basic",

        usage: 100,
        limit: `${YY}-${MM}-${DD}`,

        name: signName.value,
        email: signEmail.value,
        phone: signPhone.value,

        refcode: signRefCode.disabled ? signRefCode.value : "",
    };

    let signResp = await fetch(FLASK_URL + "signup", {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify(info),

        method: "POST"
    });

    let signText = await signResp.text();

    await sleep(1000 * 1);

    switch (signText) {
        case "SUCCESS": {
            alert("회원가입이 완료되었습니다.");

            headerMain.style.display = "";
            headerSignUp.style.display = "none";

            localStorage.setItem('validPC', 'invalid')

            break;
        }

        case "FAILED": {
            alert("이미 사용 중인 아이디입니다.");

            break;
        }

        default: break;
    }

    signSubmit.innerHTML = '가입하기';
}

async function isValidPhone() {
    let info = {
        phone: signPhone.value
    }

    let phoneResp = await fetch(FLASK_URL + "validphone", {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify(info),

        method: "POST"
    });

    let phoneJson = await phoneResp.json();

    console.log(phoneJson);

    switch (phoneJson.status) {
        case "SUCCESS": {
            return true;
        }

        default: {
            return false;
        }
    }
}

async function main() {
    let appInfo = localStorage.getItem('appInfo');

    if (appInfo) {
        appData = JSON.parse(appInfo);

        autoFillId.checked = appData.settings.autoFillId;
        autoSignIn.checked = appData.settings.autoLogin;

        if (appData.settings.autoLogin) {
            appId.value = appData.user.id;
            appPassword.value = appData.user.pw;

            if (appData.login) {
                onSignIn();
            }
        } else {
            if (appData.settings.autoFillId) {
                appId.value = appData.user.id;
            }
        }
    }

    signIn.addEventListener('click', onSignIn);
    signSubmit.addEventListener('click', onSignUp);
    signUp.addEventListener('click', () => {
        headerMain.style.display = "none";
        headerSignUp.style.display = "";
    });

    signAgain.addEventListener('click', () => {
        headerMain.style.display = "";
        headerSignUp.style.display = "none";
    });

    signIdVerify.addEventListener('click', async () => {
        if (!signId.value) {
            alert("아이디를 입력해주세요.");

            return;
        }

        let info = {
            id: signId.value
        }

        let signResp = await fetch(FLASK_URL + "signcheck", {
            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify(info),

            method: "POST"
        });

        let signText = await signResp.text();

        switch (signText) {
            case "SUCCESS": {
                alert(`사용 가능한 아이디(${signId.value}) 입니다.`);

                break;
            }

            case "FAILED": {
                alert(`사용할 수 없는 아이디(${signId.value}) 입니다.`);

                break;
            }

            default: break;
        }
    });

    refCodeVerify.addEventListener('click', async () => {
        if (!signRefCode.value) {
            alert("추천인코드를 입력해주세요.");

            return;
        }

        let info = {
            id: signRefCode.value
        }

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
                let time = new Date().getTime();
                let limited = new Date(`${userJson.limit} 23:59:59`).getTime();

                if (userJson.rank === "basic" || time > limited) {
                    alert(`추천인코드(${signRefCode.value})는 정식 이용자만 입력 가능합니다.`);

                    break;
                }

                alert(`추천인코드(${signRefCode.value})가 입력되었습니다.`);

                signRefCode.disabled = true;

                break;
            }

            default: {
                alert(`추천인코드(${signRefCode.value})가 유효하지 않습니다.`);

                break;
            }
        }
    });

    signPhoneVerify.addEventListener('click', async () => {
        if (!signPhone.value) {
            alert("휴대폰 번호를 입력해주세요.");

            return;
        }

        if (signPhone.value.includes("-")) {
            alert(`"-"표시를 제외한 숫자 형태로만 입력해주세요.`);

            return;
        }

        let test = await isValidPhone();

        if (!test) {
            alert(`이미 등록된 휴대폰 번호입니다.`);

            return;
        }

        if (isVerifying) {
            alert("진행중인 인증을 완료해주세요.");

            return;
        }

        isVerifying = true;

        verifyContent.style.display = "";
        verifyDigit = Math.floor(1000 + Math.random() * 9000);
        verifyTimer = 59;

        let verfifyData = {
            "type": "SMS",
            "contentType": "COMM",
            "countryCode": "82",
            "from": "07040647890",
            "subject": "[트랜져스] 제목",
            "content": `인증번호 [${verifyDigit}]를 입력해주세요.`,
            "messages": [
                {
                    "to": signPhone.value,
                }
            ],
        };

        const now = new Date().getTime();
        const path = `/sms/v2/services/ncp:sms:kr:259001473572:verification/messages`;
        const accesskey = "xzd0g9r6eCQ8uS8033tu";
        const secretkey = "Hb3DJDmA0WaxXqE8qUWm4a6dSf2vliE7dizN3nq1";
        const base_str = `POST ${path}\n${now}\n${accesskey}`;
        const signature = CryptoJS.HmacSHA256(base_str, secretkey).toString(CryptoJS.enc.Base64);

        await fetch(`https://sens.apigw.ntruss.com${path}`, {
            headers: {
                "Content-Type": "application/json; charset=utf-8",

                "x-ncp-apigw-timestamp": now,
                "x-ncp-iam-access-key": accesskey,
                "x-ncp-apigw-signature-v2": signature
            },

            method: "POST",
            body: JSON.stringify(verfifyData)
        });

        alert("인증번호가 발송되었습니다.");

        while (true) {
            if (!isVerifying) {
                break;
            }

            if (verifyTimer === 0) {
                alert("인증이 취소되었습니다.");

                signPhoneVerify.innerHTML = "인증";
                verifyContent.style.display = "none";

                isVerifying = false;

                break;
            }

            signPhoneVerify.innerHTML = `0:${verifyTimer.toString().padStart(2, '0')}`;

            verifyTimer -= 1;

            await sleep(1000 * 1);
        }
    });

    verifyAccept.addEventListener('click', () => {
        if (!isVerifying) {
            alert("인증시간이 초과되었습니다.");

            return;
        }

        if (!verifyCode.value) {
            alert("인증번호를 입력해주세요.");

            return;
        }

        if (verifyCode.value !== verifyDigit.toString()) {
            alert("인증번호가 올바르지 않습니다.");

            return;
        }

        isVerifying = false;

        verifyContent.style.display = "none";

        signPhone.disabled = true;
        signPhoneVerify.disabled = true;
        signPhoneVerify.className = "button round";
        signPhoneVerify.innerHTML = "인증완료";

        alert("인증되었습니다.");
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (headerMain.style.display === "") {
                onSignIn();
            } else {
                onSignUp();
            }
        }
    })
}

main();