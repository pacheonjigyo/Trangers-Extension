import CryptoJS from "crypto-js";

import { fabric } from "fabric";
import { urlList, floatingToast, getClock, readFileAsync, sleep } from "../common";

const ENDPOINT_SELLFORYOU = "https://api.sellforyou.co.kr/";
const FLASK_URL = "http://www.sellforyou.co.kr:5003/trangers/";

let appData = null;
let areaPos = {};

let cropRectangle = null;
let cropRatioType = null;

let currentImageIndex = null;
let currentType = null;

let dragImage = null;

let editorMode = 'idle';

let isLocal = false;
let isShapeFill = true;
let isDrag = false;
let isOriginal = false;

let layers = [];
let copyBox = [];
let newLayer = [];
let cancel = false;

let maskCanvas = new fabric.Canvas('mask');
let myCanvas = new fabric.Canvas('main');

let orgCanvas = new fabric.Canvas('original');

let uploadImages;

let visionKey = null;

let removeType = 'area-remove-drag';
let recoveryType = 'area-recovery-drag';
let selectType = null;

async function loadProject(project) {
    isLocal = project.isLocal;
    uploadImages = project.uploadImages;
    layers = project.layers;

    project.layers.map((v) => {
        v.object.map((w) => {
            delete w['text'];
            delete w['rect'];
        })
    })

    if (isLocal) {
        currentType = "0";
        headerFromPC.style.display = "";
    } else {
        currentType = "1";
        headerFromURL.style.display = "";
    }

    await loadImageList();
    menuToolbar.style.display = "";
}

function saveLocalSettings(key, value) {
    appData = {
        ...appData,

        settings: {
            ...appData.settings,

            [key]: value
        }
    }

    localStorage.setItem('appInfo', JSON.stringify(appData));
}

function loadLocalSettings() {
    applyWaterMarkText.value = appData.settings.waterMarkText ?? appData.user.id;
    applyWaterMarkOpacity.value = appData.settings.waterMarkOpacity ?? "20";
    applyOriginWidthPC.value = appData.settings.originWidthPC ?? "Y";
    originWidthPC.value = appData.settings.originWidthPCSize ?? "";
    applyOriginWidthThumbnail.value = appData.settings.originWidthThumbnail ?? "Y";
    originWidthThumbnail.value = appData.settings.originWidthThumbnailSize ?? "";
    applyOriginWidthOption.value = appData.settings.originWidthOption ?? "Y";
    originWidthOption.value = appData.settings.originWidthOptionSize ?? "";
    applyOriginWidthDescription.value = appData.settings.originWidthDescription ?? "Y";
    originWidthDescription.value = appData.settings.originWidthDescriptionSize ?? "";
    applySensitive.value = appData.settings.originSensitive ?? "0.03";

    if (applyOriginWidthPC.value === 'N') {
        originWidthPC.disabled = false;
    }

    if (applyOriginWidthThumbnail.value === 'N') {
        originWidthThumbnail.disabled = false;
    }

    if (applyOriginWidthOption.value === 'N') {
        originWidthOption.disabled = false;
    }

    if (applyOriginWidthDescription.value === 'N') {
        originWidthDescription.disabled = false;
    }

    let radioExtensionType = document.getElementsByName('extensionType');

    for (let i = 0; i < radioExtensionType.length; i++) {
        if (radioExtensionType[i].value === appData.settings.extensionType) {
            radioExtensionType[i].parentNode.className = "radio activated";
        }

        radioExtensionType[i].addEventListener('change', (e) => {
            for (let j = 0; j < radioExtensionType.length; j++) {
                if (e.target.value === radioExtensionType[j].value) {
                    radioExtensionType[j].parentNode.className = "radio activated";

                    saveLocalSettings('extensionType', e.target.value);
                } else {
                    radioExtensionType[j].parentNode.className = "radio default";
                }
            }
        });
    }

    let waterMarkType = document.getElementsByName('waterMarkType');

    for (let i = 0; i < waterMarkType.length; i++) {
        if (waterMarkType[i].value === appData.settings.waterMarkType) {
            waterMarkType[i].parentNode.className = "radio activated";
        }

        waterMarkType[i].addEventListener('change', (e) => {
            for (let j = 0; j < waterMarkType.length; j++) {
                if (e.target.value === waterMarkType[j].value) {
                    waterMarkType[j].parentNode.className = "radio activated";

                    saveLocalSettings('waterMarkType', e.target.value);

                    displayImage(currentImageIndex);
                } else {
                    waterMarkType[j].parentNode.className = "radio default";
                }
            }
        });
    }
}

function getCurrentLayer() {
    let layer = layers.filter((v) => {
        if (v.index !== currentImageIndex || v.type !== currentType) {
            return false;
        }

        return true;
    });

    return layer[0];
}

function onLogout() {
    appData = {
        ...appData,

        login: false
    }

    localStorage.setItem('appInfo', JSON.stringify(appData));

    window.location.href = "./login.html";
}

function mergeImage(dataUrl) {
    return new Promise((resolve, reject) => {
        let cropped = new Image();

        cropped.src = dataUrl;
        cropped.onload = function () {
            resolve(cropped);
        };

        cropped.onerror = reject;
    });
}

async function saveCanvas() {
    let layer = getCurrentLayer();
    let canvas = JSON.stringify(myCanvas.toObject(['id', 'selectable']));
    let object = JSON.stringify(layer.object);

    layer.state.redo = {
        canvas: [],
        object: []
    };

    if (layer.state.current.canvas) {
        layer.state.undo.canvas.push(layer.state.current.canvas);
    }

    if (layer.state.current.object) {
        layer.state.undo.object.push(layer.state.current.object);
    }

    layer.state.current.canvas = canvas;
    layer.state.current.object = object;
}

function replayCanvas(type) {
    let layer = getCurrentLayer();

    let playStack = null;
    let saveStack = null;

    switch (type) {
        case "undo": {
            playStack = layer.state.undo;
            saveStack = layer.state.redo;

            break;
        }

        case "redo": {
            playStack = layer.state.redo;
            saveStack = layer.state.undo;

            break;
        }

        default: break;
    }

    let stateCanvas = playStack.canvas.pop();
    let stateObject = playStack.object.pop();

    if (!stateCanvas || !stateObject) {
        return;
    }

    saveStack.canvas.push(layer.state.current.canvas);
    saveStack.object.push(layer.state.current.object);

    myCanvas.clear();
    myCanvas.loadFromJSON(stateCanvas, async function () {
        myCanvas.renderAll();

        layer.image.current = myCanvas.backgroundImage?.src ?? myCanvas.overlayImage.src;
        layer.object = [];

        let object = JSON.parse(stateObject);

        myCanvas.getObjects().map((v) => {
            switch (v.type) {
                case "i-text": {
                    layer.object.push({
                        ...object[v.id],

                        text: v
                    });

                    break;
                }

                case "rect": {
                    layer.object.push({
                        ...object[v.id],

                        rect: v
                    });

                    break;
                }
            }
        });

        layer.state.current.canvas = stateCanvas;
        layer.state.current.object = stateObject;

        await displayImage(currentImageIndex);
    });
}

async function translationPapago(input_string, source, target) {
    let deviceid = "364961ac-efa2-49ca-a998-ad55f7f9d32d";
    let url = "https://papago.naver.com/apis/n2mt/translate";
    let time = new Date().getTime();

    let hash = CryptoJS.HmacMD5(`${deviceid}\n${url}\n${time}`, 'v1.7.0_0d2601d5cf').toString(CryptoJS.enc.Base64);

    let encoded = encodeURI(input_string);

    encoded = encoded.replaceAll(";", "%2B");
    encoded = encoded.replaceAll("/", "%2F");
    encoded = encoded.replaceAll("?", "%3F");
    encoded = encoded.replaceAll(":", "%3A");
    encoded = encoded.replaceAll("@", "%40");
    encoded = encoded.replaceAll("=", "%3D");
    encoded = encoded.replaceAll("+", "%2B");
    encoded = encoded.replaceAll(",", "%2C");
    encoded = encoded.replaceAll("$", "%24");

    let output = await fetch("https://papago.naver.com/apis/n2mt/translate", {
        "headers": {
            "authorization": `PPG ${deviceid}:${hash}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "timestamp": `${time}`,
            "x-apigw-partnerid": "papago",
        },

        "body": `deviceId=${deviceid}&locale=ko&dict=true&dictDisplay=30&honorific=false&instant=false&paging=false&source=${source}&target=${target}&text=${encoded}`,
        "method": "POST",
    });

    try {
        let result = await output.json();
        let result_array = result.translatedText.split("\n");

        return result_array;
    } catch (e) {
        return null;
    }
}

async function displayImage(index, customWidth) {

    currentImageIndex = index;

    let imageList = document.getElementsByClassName('image-thumbnail');

    for (let i = 0; i < imageList.length; i++) {
        if (imageList[i].getAttribute('key') === currentImageIndex.toString()) {
            imageList[i].className = "image-thumbnail activated";
        } else {
            imageList[i].className = "image-thumbnail deactivated";
        }

    }

    orgCanvas.clear();
    myCanvas.clear();

    let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

    let originalImage = null;
    let currentImage = null;

    let layer = getCurrentLayer();

    if (!layer) {
        return;
    }

    let originalMerged = await mergeImage(layer.image.origin);

    originalImage = new fabric.Image(originalMerged);
    originalImage.set({
        selectable: false
    });

    orgCanvas.setDimensions({
        width: originalImage.width / (100 / percentage),
        height: originalImage.height / (100 / percentage),
    });

    orgCanvas.add(originalImage);
    orgCanvas.zoomToPoint(new fabric.Point(0, 0), percentage / 100);
    orgCanvas.renderAll();

    if (isOriginal) {
        myCanvas.setDimensions({
            width: originalImage.width / (100 / percentage),
            height: originalImage.height / (100 / percentage),
        });

        myCanvas.add(originalImage);
        myCanvas.zoomToPoint(new fabric.Point(0, 0), percentage / 100);
        myCanvas.renderAll();

        return;
    }

    let currentMerged = await mergeImage(layer.image.current);

    currentImage = new fabric.Image(currentMerged);
    currentImage.set({
        id: currentImageIndex,
        selectable: false
    });

    myCanvas.setDimensions({
        width: currentImage.width / (100 / percentage),
        height: currentImage.height / (100 / percentage),
    });
    layer.object.map((v, i) => {

        switch (v.object) {
            case "rect": {
                if (!v.rect) {
                    let rect = new fabric.Rect({
                        id: i,
                        left: v.copyX ? v.copyX + v.pos[0].x : currentImage.left + v.pos[0].x,
                        top: v.copyY ? v.copyY + v.pos[0].y : currentImage.top + v.pos[0].y,
                        width: v.pos[3].x == 0 ? 150 : v.pos[3].x,
                        height: v.pos[3].y == 0 ? 150 : v.pos[3].y,
                        fill: v.background ? `rgb(${v.background.R},${v.background.G},${v.background.B})` : 'transparent',
                        stroke: v.foreground ? `rgb(${v.foreground.R},${v.foreground.G},${v.foreground.B})` : 'black',
                        strokeWidth: v.shapeOption.strokeWidth ?? null,
                        rx: v.shapeOption.rx ?? null,
                        ry: v.shapeOption.ry ?? null,
                        noScaleCache: false,
                        strokeUniform: true,
                        angle: v.angle ?? 0,
                    });
                    v.rect = rect;

                }

                v.rect.set({
                    selectable: (
                        editorMode === 'area-translation' ||
                        editorMode === 'area-remove-drag' ||
                        editorMode === 'area-remove-brush' ||
                        editorMode === 'area-recovery-drag' ||
                        editorMode === 'area-recovery-brush' ||
                        editorMode === 'crop'
                    ) ? false : true
                });

                myCanvas.add(v.rect);
                myCanvas.sendToBack(v.rect);
                break;
            };

            case "i-text": {
                let pos = v.pos;

                let xList = [];
                let yList = [];

                pos.map((w) => {
                    xList.push(w.x);
                    yList.push(w.y);

                    return;
                });

                let xMax = Math.max(...xList);
                let xMin = Math.min(...xList);
                let yMax = Math.max(...yList);
                let yMin = Math.min(...yList);

                let offset = 0;

                xMax = xMax * (1 + offset);
                xMin = xMin * (1 - offset);
                yMax = yMax * (1 + offset);
                yMin = yMin * (1 - offset);

                let posText = {
                    x: currentImage.left + xMin,
                    y: currentImage.top + yMin,
                    width: xMax - xMin,
                    height: yMax - yMin,
                };

                if (!v.text) {
                    let text = new fabric.IText(v.translated, {
                        id: i,
                        left: v.copyX ? v.copyX + v.pos[0].x : currentImage.left + v.pos[0].x,
                        top: v.copyY ? v.copyY + v.pos[0].y : currentImage.top + v.pos[0].y,
                        width: v.pos[3].x == 0 ? 300 : v.pos[3].x,
                        height: v.pos[3].y == 0 ? 300 : v.pos[3].y,
                        fill: v.foreground ? `rgb(${v.foreground.R},${v.foreground.G},${v.foreground.B})` : 'black',
                        backgroundColor: v.background ? `rgb(${v.background.R},${v.background.G},${v.background.B})` : 'transparent',
                        fontFamily: v.textOption.font,
                        fontStyle: v.textOption.italic,
                        fontSize: v.textOption.size ?? 1,
                        fontWeight: v.textOption.bold,
                        linethrough: v.textOption.lineThrough,
                        selectable: true,
                        noScaleCache: false,
                        angle: v.angle ?? 0,
                    });


                    if (v.textOption.size) {
                        text.set({
                            fontSize: v.textOption.size
                        })
                    } else {
                        let fontSize = text.fontSize;

                        while (true) {

                            if (text.width >= posText.width) {
                                break;
                            }

                            fontSize += 1;

                            text.set({
                                fontSize: fontSize
                            })
                        }

                        v.textOption.size = fontSize;
                    }

                    v.text = text;
                }

                v.text.set({
                    selectable: (
                        editorMode === 'area-translation' ||
                        editorMode === 'area-remove-drag' ||
                        editorMode === 'area-remove-brush' ||
                        editorMode === 'area-recovery-drag' ||
                        editorMode === 'area-recovery-brush' ||
                        editorMode === 'crop'
                    ) ? false : true
                });

                myCanvas.add(v.text);

                break;
            };

            default: break;
        }
    });

    if (appData.settings.waterMarkType === "Y" && applyWaterMarkText.value) {
        let text = new fabric.IText(applyWaterMarkText.value, {
            fontFamily: "NNSQUAREROUNDR",
            fontSize: 2,

            opacity: applyWaterMarkOpacity.value / 100,
        });

        while (true) {
            if (text.width >= currentImage.width / 2) {
                break;
            }

            text.set({
                fontSize: text.fontSize + 1,
                selectable: false,
                evented: false
            });
        }

        text.set({
            left: (currentImage.width / 2) - (text.width / 2),
            top: (currentImage.height / 2) - (text.height / 2),
        })

        myCanvas.add(text);
    }


    switch (editorMode) {
        case "crop": {
            myCanvas.uniformScaling = cropRatioType === "3" ? false : true;

            myCanvas.setOverlayImage(currentImage, function () {
                myCanvas.renderAll();
            }, {
                globalCompositeOperation: 'destination-atop'
            });

            let overlay = new fabric.Rect({
                left: -1,

                width: currentImage.width + 2,
                height: currentImage.height,

                fill: "black",
                opacity: 0.5,

                selectable: false,

                globalCompositeOperation: 'source-over'
            });

            myCanvas.add(overlay);

            cropRectangle = new fabric.Rect({
                id: -1,

                active: true,

                width: cropRatioType === "2" ? currentImage.width < currentImage.height ? currentImage.width : currentImage.height : currentImage.width,
                height: cropRatioType === "2" ? currentImage.width < currentImage.height ? currentImage.width : currentImage.height : currentImage.height,

                selectable: true,

                lockScalingFlip: true,

                globalCompositeOperation: 'destination-out',
            });

            cropRectangle.setControlsVisibility({
                mtr: false,

                mb: cropRatioType === "3" ? true : false,
                ml: cropRatioType === "3" ? true : false,
                mr: cropRatioType === "3" ? true : false,
                mt: cropRatioType === "3" ? true : false,
            });

            myCanvas.add(cropRectangle);
            myCanvas.setActiveObject(cropRectangle);

            break;
        }

        case "download": {
            if (appData.settings.waterMarkType === "Y" && applyWaterMarkText.value) {
                let text = new fabric.IText(applyWaterMarkText.value, {
                    fontFamily: "NNSQUAREROUNDR",
                    fontSize: 2,

                    opacity: applyWaterMarkOpacity.value / 100,
                });

                while (true) {
                    if (text.width >= currentImage.width / 2) {
                        break;
                    }

                    text.set({
                        fontSize: text.fontSize + 1,
                        selectable: false,
                        evented: false
                    });
                }

                text.set({
                    left: (currentImage.width / 2) - (text.width / 2),
                    top: (currentImage.height / 2) - (text.height / 2),
                })

                myCanvas.add(text);
            }

            myCanvas.setBackgroundImage(currentImage);

            break;
        }

        default: {
            myCanvas.setBackgroundImage(currentImage);

            break;
        }
    }

    let actualWidth = null;
    let actualHeight = null;

    if (customWidth) {
        let aspectRatio = customWidth / currentImage.width;

        actualWidth = customWidth;
        actualHeight = currentImage.height * aspectRatio;

        myCanvas.zoomToPoint(new fabric.Point(0, 0), aspectRatio);
    } else {
        actualWidth = currentImage.width;
        actualHeight = currentImage.height;

        myCanvas.zoomToPoint(new fabric.Point(0, 0), 1.0);
    }

    let resultData = myCanvas.toDataURL({
        width: actualWidth,
        height: actualHeight,

        format: appData.settings.extensionType
    });

    myCanvas.zoomToPoint(new fabric.Point(0, 0), percentage / 100);
    myCanvas.renderAll();

    return resultData;

}

async function processVisionData(info) {
    try {
        startRegion.disabled = true;
        endRegion.disabled = true;

        let layer = getCurrentLayer();

        let visionData = {
            "requests": [{
                "features": [{
                    "maxResults": 3,
                    "type": "TEXT_DETECTION"
                }],

                "image": {
                    "content": info?.image.split(",")[1] ?? layer.image.current.split(",")[1]
                },

                "image_context": {
                    "language_hints": startRegion.value
                }
            }]
        };

        let visionResp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
            headers: {
                "Content-Type": "application/json"
            },
        
            body: JSON.stringify(visionData),
            method: "POST"
        });

        let visionJson = await visionResp.json();
        let visionArray = await visionAnalyzer(visionJson.responses[0]);

        if (visionArray.length === 0) {
            return;
        }

        let pos = info?.pos;

        if (pos) {
            visionArray.map((v) => {
                v.pos.map((w) => {
                    w.x += info.pos.x;
                    w.y += info.pos.y;
                });
            });
        }
        
        let colorResp = await fetch(FLASK_URL + "getcolor", {
            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                image: layer.image.current.split(",")[1],
                data: visionArray
            }),

            method: "POST"
        });

        let colorJson = await colorResp.json();
        let objectList = [];
        let sensitive = parseFloat(appData.settings.originSensitive);

        for (let i = 0; i < visionArray.length; i++) {
            let xList = [];
            let yList = [];
            
            visionArray[i].pos.map((w) => {
                xList.push(w.x);
                yList.push(w.y);

                return;
            });

            let xMax = Math.max(...xList);
            let xMin = Math.min(...xList);
            let yMax = Math.max(...yList);
            let yMin = Math.min(...yList);

            xMax = xMax * (1 + sensitive);
            xMin = xMin * (1 - sensitive);
            yMax = yMax * (1 + sensitive);
            yMin = yMin * (1 - sensitive);
            
            let rect = new fabric.Rect({
                left: xMin,
                top: yMin,
                width: xMax - xMin,
                height: yMax - yMin,
                fill: `white`,
            });

            objectList.push(rect);

            let translated = visionArray[i].translated;

            if(visionArray[i].direction == "vertical"){
                translated = visionArray[i].translated.match(/.{1}/g).join("\n");
            }
            
            layer.object.push({
                "foreground": colorJson.data[i].foreground,
                "object": "i-text",
                "original": visionArray[i].original,
                "pos": visionArray[i].pos,
                "translated": translated,
                "textOption": {
                    "bold": toolTextBold.checked ? "bold" : "normal",
                    "font": toolTextFont.value,
                    "italic": toolTextItalic.checked ? "italic" : "normal",
                    "lineThrough": toolTextLineThrough.checked,
                    "underLine": toolTextUnderLine.checked,
                    "direction": visionArray[i].direction,
                },
            });
        }
        await getMaskImage(objectList);

    } catch (e) {
        alert('번역 도중 오류가 발생하였습니다.');

        console.log('번역 에러:', e);
    }
}

function dataURItoBlob(dataURI) {
    const mime = dataURI.split(',')[0].split(':')[1].split(';')[0]
    const binary = atob(dataURI.split(',')[1])
    const array = []

    for (let i = 0; i < binary.length; i += 1) {
        array.push(binary.charCodeAt(i))
    }

    return new Blob([new Uint8Array(array)], { type: mime })
}

async function getMaskImage(itemList) {
    let layer = getCurrentLayer();

    let chunk = await new Promise((resolve, reject) => {
        try {
            new fabric.Image.fromURL(layer.image.current, async (image) => {
                image.set({
                    left: 0,
                    top: 0,
                    width: image.width,
                    height: image.height,
                });

                resolve(image);
            })
        } catch (e) {
            reject(e);
        }
    });

    maskCanvas.clear();
    maskCanvas.setDimensions({
        width: chunk.width,
        height: chunk.height
    });

    maskCanvas.backgroundColor = "black";

    itemList.map((v) => {
        maskCanvas.add(v);
    });

    let image = chunk.getSrc();
    let maskImage = maskCanvas.toDataURL();

    let formData = new FormData();

    formData.append('image', dataURItoBlob(image));
    formData.append('mask', dataURItoBlob(maskImage));
    formData.append('ldmSteps', 50);
    formData.append('hdStrategy', 'Original');
    formData.append('hdStrategyCropMargin', 128);
    formData.append('hdStrategyCropTrigerSize', 2048);
    formData.append('hdStrategyResizeLimit', 2048);
    formData.append('sizeLimit', 'Original');

    let dataResp = await fetch("http://101.79.8.236:9999/inpaint", {
        method: "POST",
        body: formData
    });

    let dataBlob = await dataResp.blob();
    let dataBase64 = await readFileAsync(dataBlob);
    let dataMerged = await mergeImage(dataBase64);

    let result = new fabric.Image(dataMerged);

    result.set({
        id: currentImageIndex,
        selectable: false
    });

    layer.image.current = dataBase64;

    await displayImage(currentImageIndex);
}

async function visionAnalyzer(data) {
    if (!data.fullTextAnnotation) {
        return [];
    }

    let vision_count = 0;

    let vision_input = data.fullTextAnnotation.text.replaceAll("&", "");

    let vision_text = "";
    let vision_text_list = await translationPapago(vision_input, startRegion.value, endRegion.value);

    let vision_pos = [];
    let vision_info = [];

    let direction = "horizontal";

    let vision_blocks = data.fullTextAnnotation.pages[0].blocks;

    for (let a in vision_blocks) {
        let vision_paragraphs = vision_blocks[a].paragraphs;

        for (let b in vision_paragraphs) {
            let vision_words = vision_paragraphs[b].words;

            for (let c in vision_words) {
                let vision_symbols = vision_words[c].symbols;

                for (let d in vision_symbols) {
                    vision_text += vision_symbols[d].text;

                    if (vision_pos.length === 0) {
                        vision_pos = vision_symbols[d].boundingBox.vertices;
                    } else {
                        vision_pos[1] = vision_symbols[d].boundingBox.vertices[1];
                        vision_pos[2] = vision_symbols[d].boundingBox.vertices[2];

                        let width = "";
                        let height = "";

                        width = vision_symbols[d].boundingBox.vertices[1].x - vision_paragraphs[b].boundingBox.vertices[0].x;
                        height = vision_symbols[d].boundingBox.vertices[3].y - vision_paragraphs[b].boundingBox.vertices[0].y

                        if (height > width){
                            direction = "vertical";
                        } else {
                            direction = "horizontal";
                        }
                    }

                    if (vision_symbols[d].property && vision_symbols[d].property.detectedBreak) {
                        let breakType = vision_symbols[d].property.detectedBreak.type;

                        if (breakType === "LINE_BREAK" || breakType === "EOL_SURE_SPACE") {
                            vision_pos.map((v) => {
                                if (!v.x) {
                                    v.x = 0;
                                }

                                if (!v.y) {
                                    v.y = 0;
                                }
                            });

                            let offset = {
                                index: currentImageIndex,
                                Y: 0
                            };

                            let matched = /[\u4e00-\u9fff]/.test(vision_text);

                            if (startRegion.value === 'zh-CN') {

                                if (!matched) {
                                    vision_pos = [];
                                    vision_text = "";
                                    vision_count += 1;

                                    continue;
                                }
                            }

                            vision_info.push({
                                "offset": offset,
                                "pos": vision_pos,
                                "original": vision_text,
                                "translated": vision_text_list[vision_count],
                                "type": currentType,
                                "direction": direction,
                            });

                            vision_pos = [];
                            vision_text = "";
                            vision_count += 1;
                        } else if (breakType === "SPACE") {
                            vision_text += " ";
                        }
                    }
                }
            }
        }
    }

    return vision_info;
}

function sortBy(array, key, asc) {
    let sorted = array.sort(function (a, b) {
        if (a[key] < b[key]) {
            return asc ? -1 : 1;
        }

        if (a[key] > b[key]) {
            return asc ? 1 : -1;
        }

        return 0;
    });

    return sorted;
}

async function addToLayers() {
    if (isLocal) {
        currentType = "0";

        await Promise.all(uploadImages.map((v, i) => {
            currentImageIndex = i;

            let layer = getCurrentLayer();

            if (!layer) {
                layers.push({
                    type: currentType,

                    index: i,

                    image: {
                        origin: v,
                        current: v
                    },

                    object: [],

                    state: {
                        undo: {
                            canvas: [],
                            object: []
                        },

                        redo: {
                            canvas: [],
                            object: []
                        },

                        current: {},

                        check: "checked"
                    }
                });
            }
        }));

        layers = sortBy(layers, "index", true);
    } else {
        currentType = "1";

        await Promise.all(uploadImages.imageThumbnails.map(async (v, i) => {
            currentImageIndex = i;

            let layer = getCurrentLayer();

            if (!layer) {
                let imageResp = await fetch(v);
                let imageBlob = await imageResp.blob();
                let imageData = await readFileAsync(imageBlob);

                layers.push({
                    type: currentType,

                    index: i,

                    image: {
                        origin: imageData,
                        current: imageData
                    },

                    object: [],

                    state: {
                        undo: {
                            canvas: [],
                            object: []
                        },

                        redo: {
                            canvas: [],
                            object: []
                        },

                        current: {},

                        check: "checked"
                    }
                });
            }
        }));

        currentType = "2";

        await Promise.all(uploadImages.imageOptions.map(async (v, i) => {
            currentImageIndex = i;

            let layer = getCurrentLayer();

            if (!layer) {
                let imageResp = await fetch(v);
                let imageBlob = await imageResp.blob();
                let imageData = await readFileAsync(imageBlob);

                layers.push({
                    type: currentType,

                    index: i,

                    image: {
                        origin: imageData,
                        current: imageData
                    },

                    object: [],

                    state: {
                        undo: {
                            canvas: [],
                            object: []
                        },

                        redo: {
                            canvas: [],
                            object: []
                        },

                        current: {},

                        check: "checked"
                    }
                });
            }
        }));

        currentType = "3";

        await Promise.all(uploadImages.imageDescriptions.map(async (v, i) => {
            currentImageIndex = i;

            let layer = getCurrentLayer();

            if (!layer) {
                let imageResp = await fetch(v);
                let imageBlob = await imageResp.blob();
                let imageData = await readFileAsync(imageBlob);

                layers.push({
                    type: currentType,

                    index: i,

                    image: {
                        origin: imageData,
                        current: imageData
                    },

                    object: [],

                    state: {
                        undo: {
                            canvas: [],
                            object: []
                        },


                        redo: {
                            canvas: [],
                            object: []
                        },

                        current: {},

                        check: "checked"
                    }
                });
            }
        }));

        layers = sortBy(layers, "index", true);
        layers = sortBy(layers, "type", true);
    }

}

async function loadImageList() {
    imageList.innerHTML = ``;

    newLayer = layers.filter((v) => v.type === currentType);

    let filterdImages = [];

    if (isLocal) {
        selectTranslationType.style.display = "none";
        multipleTranslation.style.borderRadius = "5px";

        uploadImages.map((v, i) => {
            imageList.innerHTML += `
            <div class="imageListDiv">
                <img class="image-thumbnail" key=${i} src=${v} alt="" width="72px" height="72px" style="cursor: pointer; margin: 5px;" />
                <input id="check${i}" class="checkBox" key=${i} type="checkbox" ${newLayer[i].state.check}>
            </div>
            `;
        });

        if(uploadImages.length > 21) {
            headerSider.style.overflowX = "auto";
            headerFromPC.style.bottom = "100px";
        }
        
    } else {

        switch (currentType) {
            case "1": {
                filterdImages = uploadImages.imageThumbnails;

                break;
            }

            case "2": {
                filterdImages = uploadImages.imageOptions;
              

                break;
            }

            case "3": {
                filterdImages = uploadImages.imageDescriptions;

                break;
            }

            case "4": {
                if (!uploadImages.videoUrl) {
                    imageList.innerHTML += `<div class="imageListDiv"> </div>`;
                    break;
                }

                imageList.innerHTML += `
                <div class="imageListDiv">
                    <video class="video-thumbnail" src=${uploadImages.videoUrl} alt="" width="72px" height="72px" style="cursor: pointer; object-fit: cover; margin: 5px;" />
                </div>
                `;
                
                break;
            }

            default: break;
        }

        if(filterdImages.length == 0) {
            imageList.innerHTML += `<div class="imageListDiv"> </div>`;
        }

        for (let i = 0; i < filterdImages.length; i++) {
            imageList.innerHTML += `
            <div class="imageListDiv">
                <img class="image-thumbnail" key=${i} src=${filterdImages[i]} alt="" width="72px" height="72px" style="cursor: pointer; margin: 5px;" />
                <input id="check${i}" class="checkBox" key=${i} type="checkbox" ${newLayer[i].state.check}>
            </div>
            `;
        }
        if(filterdImages.length > 21) {
            headerSider.style.overflowX = "auto";
            headerFromURL.style.bottom = "100px";
        } else {
            headerFromURL.style.bottom = "83px";
        }
    }


    let checked = document.getElementsByClassName(`checkBox`);

    for (let i = 0; i < checked.length; i++) {
        checked[i].addEventListener('click', () => {
            if (newLayer[i].state.check == "checked") {
                newLayer[i].state.check = "";
                checked[i].checked = false;

            } else if (newLayer[i].state.check == "") {
                newLayer[i].state.check = "checked";
                checked[i].checked = true;

            }
        });
    }

    checkAll.addEventListener('click', async () => {
        for (let i = 0; i < newLayer.length; i++) {
            newLayer[i].state.check = "checked";
            try {
                checked[i].checked = true;

            } catch (e) {
                continue;
            }
        }
    });

    checkDel.addEventListener('click', async () => {

        for (let i = 0; i < newLayer.length; i++) {
            newLayer[i].state.check = "";
            try {
                checked[i].checked = false;
            } catch (e) {
                continue;
            }
        }
    });


    let imageElement = document.getElementsByClassName(`image-thumbnail`);

    for (let i = 0; i < imageElement.length; i++) {
        imageElement[i].addEventListener('click', async () => {
            await displayImage(i);

            saveCanvas();
        });
    }

    let videoElement = document.getElementsByClassName('video-thumbnail');

    for (let i = 0; i < videoElement.length; i++) {
        videoElement[i].addEventListener('click', async (e) => {
            window.open(e.target.src);
        });
    }

    await displayImage(0);

    saveCanvas();

    headerMain.style.display = "none";
    headerSub.style.display = "";
}

function ColorToHex(color) {
    let hexadecimal = color.toString(16);

    return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
}

function ConvertRGBtoHex(red, green, blue) {
    return "#" + ColorToHex(red) + ColorToHex(green) + ColorToHex(blue);
}

function hexToRgb(hex) {
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;

    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function canvasSetting() {
    fabric.Object.prototype.set({
        borderColor: 'rgb(41, 136, 255)',
        cornerColor: 'rgb(41, 136, 255)',
        cornerStyle: "circle",
        cornerSize: 10,
        transparentCorners: false,
    });

    myCanvas.on({
        'text:changed': (e) => {

            let object = e.target;
            let layer = getCurrentLayer();
            let objectDirection = layer.object[object.id].textOption.direction;

            switch(objectDirection){
                case "vertical" : {
                    textTranslated.value = object.textLines.join('');
                    layer.object[object.id].translated = object.text.match(/.{1}/g).join("\n");
                    object.text = textTranslated.value.match(/.{1}/g).join("\n");
                    break;
                }

                case "horizontal" : {
                    textTranslated.value = object.text;
                    layer.object[object.id].translated = object.text;

                    break;
                }
            }
        },

        'selection:created': (e) => {
            textTranslated.disabled = false;

            if (e.selected) {
                for (let i = 0; i < e.selected.length; i++) {
                    if (e.selected.length > 1) {
                        if (e.selected[0].stroke && e.selected[i].text) {

                            textTab.style.cursor = "pointer";
                            shapeTab.style.cursor = "pointer";

                            floatingTextTool.style.left = `${e.e.x}px`;
                            floatingTextTool.style.top = `${e.e.y}px`;
                            floatingTextTool.style.display = "";

                            floatingShapeTool.style.left = `${e.e.x}px`;
                            floatingShapeTool.style.top = `${e.e.y - 50}px`;
                            floatingShapeTool.style.display = "";

                            return;

                        } else if (e.selected[i].text) {
                            fixedTextTool.style.display = "";
                            fixedShapeTool.style.display = "none";

                            textTab.style.backgroundColor = "rgb(80, 80, 80)";
                            shapeTab.style.backgroundColor = "rgb(65, 65, 65)";

                            textTab.style.cursor = "pointer";
                            shapeTab.style.cursor = "";

                            floatingTextTool.style.display = "";
                            floatingTextTool.style.left = `${e.e.x}px`;
                            floatingTextTool.style.top = `${e.e.y}px`;

                        } try {
                            if (e.selected[e.selected.length - 1].stroke) {

                                fixedTextTool.style.display = "none";
                                fixedShapeTool.style.display = "";

                                textTab.style.backgroundColor = "rgb(65, 65, 65)";
                                shapeTab.style.backgroundColor = "rgb(80, 80, 80)";

                                textTab.style.cursor = "";
                                shapeTab.style.cursor = "pointer";

                                floatingShapeTool.style.display = "";
                                floatingShapeTool.style.left = `${e.e.x}px`;
                                floatingShapeTool.style.top = `${e.e.y - 50}px`;
                            }
                        } catch {
                            continue;
                        }
                    }
                }
            }

            let object = e.selected[0];
            let objectType = object.get('type');

            if (object.id === -1) {
                return;
            }

            let layer = getCurrentLayer();
            let v = layer.object[object.id];
            switch (objectType) {
                case "i-text": {

                    let size = Math.round(object.fontSize * object.scaleX);
                    object.set({
                        fontSize: size,
                        scaleX: 1,
                        scaleY: 1,
                    });

                    floatingTextTool.style.left = `${e.e.x}px`;
                    floatingTextTool.style.top = `${e.e.y}px`;
                    floatingTextTool.style.display = "";

                    fixedTextTool.style.display = "";
                    fixedShapeTool.style.display = "none";

                    textTab.style.backgroundColor = "rgb(80, 80, 80)";
                    shapeTab.style.backgroundColor = "rgb(65, 65, 65)";

                    textOriginal.value = v.original;
                    textTranslated.value = v.text.textLines.join('');
                    toolTextColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : "";
                    toolTextBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : "";
                    toolTextFont.value = v.textOption.font;
                    toolTextSize.value = size;
                    toolTextBold.checked = v.textOption.bold === "bold" ? true : false;
                    toolTextItalic.checked = v.textOption.italic === "italic" ? true : false;
                    toolTextLineThrough.checked = v.textOption.lineThrough === "lineThrough" ? true : false;
                    toolTextUnderLine.checked = v.textOption.underLine === "underLine" ? true : false;

                    fixedTextColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : "";
                    fixedTextBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : "";
                    fixedTextFont.value = v.textOption.font;
                    fixedTextSize.value = size;
                    fixedTextBold.checked = v.textOption.bold === "bold" ? true : false;
                    fixedTextItalic.checked = v.textOption.italic === "italic" ? true : false;
                    fixedTextLineThrough.checked = v.textOption.lineThrough === "lineThrough" ? true : false;
                    fixedTextUnderLine.checked = v.textOption.underLine === "underLine" ? true : false;

                    if (toolTextBold.checked) {
                        toolTextBold.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextBold.parentNode.style.color = "white";
                    }

                    if (toolTextItalic.checked) {
                        toolTextItalic.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextItalic.parentNode.style.color = "white";
                    }

                    if (toolTextLineThrough.checked) {
                        toolTextLineThrough.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextLineThrough.parentNode.style.color = "white";
                    }

                    if (toolTextUnderLine.checked) {
                        toolTextUnderLine.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextUnderLine.parentNode.style.color = "white";
                    }

                    if (fixedTextBold.checked) {
                        fixedTextBold.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextBold.parentNode.style.color = "white";
                    }

                    if (fixedTextItalic.checked) {
                        fixedTextItalic.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextItalic.parentNode.style.color = "white";
                    }

                    if (fixedTextLineThrough.checked) {
                        fixedTextLineThrough.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextLineThrough.parentNode.style.color = "white";
                    }

                    if (fixedTextUnderLine.checked) {
                        fixedTextUnderLine.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextUnderLine.parentNode.style.color = "white";
                    }

                    break;
                }

                case "rect": {

                    floatingShapeTool.style.left = `${e.e.x}px`;
                    floatingShapeTool.style.top = `${e.e.y}px`;
                    floatingShapeTool.style.display = "";


                    fixedShapeTool.style.display = "";
                    fixedTextTool.style.display = "none";


                    textTab.style.backgroundColor = "rgb(65, 65, 65)";
                    shapeTab.style.backgroundColor = "rgb(80, 80, 80)";

                    toolShapeOutlineColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    toolShapeBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    toolShapeStrokeWidth.value = v.shapeOption.strokeWidth;
                    toolShapeStrokeShape.value = v.shapeOption.rx;


                    fixedShapeOutlineColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    fixedShapeBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    fixedShapeStrokeWidth.value = v.shapeOption.strokeWidth;
                    fixedShapeStrokeShape.value = v.shapeOption.rx;

                    break;
                }

                default: break;
            }
        },

        'selection:updated': (e) => {
            textTranslated.disabled = false;

            if (e.selected.length > 1) {
                floatingTextTool.style.left = `${e.e.x}px`;
                floatingTextTool.style.top = `${e.e.y}px`;
                floatingTextTool.style.display = "";

                floatingShapeTool.style.left = `${e.e.x}px`;
                floatingShapeTool.style.top = `${e.e.y - 50}px`;
                floatingShapeTool.style.display = "";

                fixedTextTool.style.display = "";
                fixedShapeTool.style.display = "";

                tab.styel.display = "";
                textTab.style.backgroundColor = "rgb(80, 80, 80)";
                shapeTab.style.backgroundColor = "rgb(65, 65, 65)";

                return;
            }

            let object = e.selected[0];
            let objectType = object.get('type');

            if (object.id === -1) {
                return;
            }

            let layer = getCurrentLayer();
            let v = layer.object[object.id];

            switch (objectType) {
                case "i-text": {

                    floatingTextTool.style.left = `${e.e.x}px`;
                    floatingTextTool.style.top = `${e.e.y}px`;
                    floatingTextTool.style.display = "";
                    floatingShapeTool.style.display = "none";

                    fixedTextTool.style.display = "";
                    fixedShapeTool.style.display = "none";


                    textTab.style.backgroundColor = "rgb(80, 80, 80)";
                    shapeTab.style.backgroundColor = "rgb(65, 65, 65)";

                    textOriginal.value = v.original;
                    textTranslated.value = v.text.textLines.join('');
                    toolTextColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    toolTextBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    toolTextFont.value = v.textOption.font;
                    toolTextSize.value = v.text.fontSize;
                    toolTextBold.checked = v.textOption.bold === "bold" ? true : false;
                    toolTextItalic.checked = v.textOption.italic === "italic" ? true : false;
                    toolTextLineThrough.checked = v.textOption.lineThrough === "lineThrough" ? true : false;
                    toolTextUnderLine.checked = v.textOption.underLine === "underLine" ? true : false;

                    fixedTextColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    fixedTextBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    fixedTextFont.value = v.textOption.font;
                    fixedTextSize.value = v.text.fontSize;
                    fixedTextBold.checked = v.textOption.bold === "bold" ? true : false;
                    fixedTextItalic.checked = v.textOption.italic === "italic" ? true : false;
                    fixedTextLineThrough.checked = v.textOption.lineThrough === "lineThrough" ? true : false;
                    fixedTextUnderLine.checked = v.textOption.underLine === "underLine" ? true : false;

                    if (toolTextBold.checked) {
                        toolTextBold.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextBold.parentNode.style.color = "white";
                    }

                    if (toolTextItalic.checked) {
                        toolTextItalic.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextItalic.parentNode.style.color = "white";
                    }

                    if (toolTextLineThrough.checked) {
                        toolTextLineThrough.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextLineThrough.parentNode.style.color = "white";
                    }

                    if (toolTextUnderLine.checked) {
                        toolTextUnderLine.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        toolTextUnderLine.parentNode.style.color = "white";
                    }

                    if (fixedTextBold.checked) {
                        fixedTextBold.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextBold.parentNode.style.color = "white";
                    }

                    if (fixedTextItalic.checked) {
                        fixedTextItalic.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextItalic.parentNode.style.color = "white";
                    }

                    if (fixedTextLineThrough.checked) {
                        fixedTextLineThrough.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextLineThrough.parentNode.style.color = "white";
                    }

                    if (fixedTextUnderLine.checked) {
                        fixedTextUnderLine.parentNode.style.color = "rgb(41, 136, 255)";
                    } else {
                        fixedTextUnderLine.parentNode.style.color = "white";
                    }


                    break;
                }

                case "rect": {
                    floatingShapeTool.style.left = `${e.e.x}px`;
                    floatingShapeTool.style.top = `${e.e.y}px`;
                    floatingTextTool.style.display = "none";
                    floatingShapeTool.style.display = "";

                    fixedShapeTool.style.display = "";
                    fixedTextTool.style.display = "none";


                    textTab.style.backgroundColor = "rgb(65, 65, 65)";
                    shapeTab.style.backgroundColor = "rgb(80, 80, 80)";

                    toolShapeOutlineColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    toolShapeBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    toolShapeStrokeWidth.value = v.shapeOption.strokeWidth;
                    toolShapeStrokeShape.value = v.shapeOption.rx;

                    fixedShapeOutlineColor.value = v.foreground ? ConvertRGBtoHex(v.foreground.R, v.foreground.G, v.foreground.B) : undefined;
                    fixedShapeBackground.value = v.background ? ConvertRGBtoHex(v.background.R, v.background.G, v.background.B) : undefined;
                    fixedShapeStrokeWidth.value = v.shapeOption.strokeWidth;
                    fixedShapeStrokeShape.value = v.shapeOption.rx;

                    break;
                }

                default: break;
            }
        },

        'selection:cleared': () => {
            textTranslated.disabled = true;

            shapeTab.style.cursor = "";
            textTab.style.cursor = "";

            floatingTextTool.style.display = "none";
            floatingShapeTool.style.display = "none";

        },

        'object:modified': (e) => {

            try {
                if (e.target.id !== -1) {
                    let objectType = e.target.get('type');

                    let layer = getCurrentLayer();

                    switch (objectType) {
                        case "rect": {
                            layer.object[e.target.id].rect = e.target;

                            break;
                        }

                        case "i-text": {
                            layer.object[e.target.id].text = e.target;

                            break;
                        }

                        default: break;
                    }

                    myCanvas.renderAll();
                }

                saveCanvas();
            } catch (e) {
                console.log(e);
            }
        },

        'object:moving': (e) => {

            let object = e.target;
            let layer = getCurrentLayer();
            let objects = myCanvas.getActiveObject();
            let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

            let left = Math.floor(object.left / (100 / percentage));
            let top = Math.floor(object.top / (100 / percentage));
            let width = Math.floor(object.width * object.scaleX / (100 / percentage));
            let height = Math.floor(object.height * object.scaleY / (100 / percentage));

            if (left < 0) {
                object.set({
                    left: 0
                })
            }

            if (left + width > myCanvas.width) {
                object.set({
                    left: (myCanvas.width - width) * (100 / percentage)
                })
            }

            if (top < 0) {
                object.set({
                    top: 0
                })
            }

            if (top + height > myCanvas.height) {
                object.set({
                    top: (myCanvas.height - height) * (100 / percentage)
                })
            }

            if (objects.id !== -1) {
                if (objects['_objects']) {
                    for (let i in objects['_objects']) {
                        let object = objects['_objects'][i];

                        objects.set({
                            left: parseInt(objects.left),
                            top: parseInt(objects.top),
                        });
                    }

                } else {
                    layer.object[objects.id].pos[0].x = parseInt(object.left);
                    layer.object[objects.id].pos[0].y = parseInt(object.top);

                }
            }

            myCanvas.renderAll();
            return;
        },

        'object:scaling': (e) => {

            let object = e.target;
            let layer = getCurrentLayer();
            let objects = myCanvas.getActiveObject();
            let objectType = e.target.get('type');

            let height = object.getScaledHeight();
            let width = object.getScaledWidth();

            switch (objectType) {
                case "i-text": {
                    let size = Math.round(object.fontSize * object.scaleX);
                    object.set({
                        fontSize: size,
                        scaleX: 1,
                        scaleY: 1,
                    });

                    toolTextSize.value = size;
                    if (objects.text !== undefined) {
                        layer.object[objects.id].textOption.size = size;
                    }
                    saveCanvas();
                    break;
                }

                default: break;
            }

            if (editorMode === "crop") {
                let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

                let left = Math.floor(object.left / (100 / percentage));
                let top = Math.floor(object.top / (100 / percentage));
                let width = Math.floor(object.width * object.scaleX / (100 / percentage));
                let height = Math.floor(object.height * object.scaleY / (100 / percentage));

                if (left < 0 || left + width > myCanvas.width) {
                    object.set({
                        left: 0,
                        width: myCanvas.width * (100 / percentage),
                        scaleX: 1.0
                    });
                }

                if (top < 0 || top + height > myCanvas.height) {
                    object.set({
                        top: 0,
                        height: myCanvas.height * (100 / percentage),
                        scaleY: 1.0
                    });
                }
            }

            if (objects.id !== -1) {
                if (objects['_objects']) {
                    //
                } else {
                    layer.object[objects.id].pos[2].x = parseInt(width);
                    layer.object[objects.id].pos[3].x = parseInt(width);
                    layer.object[objects.id].pos[3].y = parseInt(height);

                }
            }

            myCanvas.renderAll();

            return;

        },


        'object:rotating': (e) => {

            let object = e.target;
            let layer = getCurrentLayer();
            let objects = myCanvas.getActiveObject();


            if (objects.id !== -1) {
                if (objects['_objects']) {

                } else {
                    object.set({
                        angle: object.angle,
                    });
                    layer.object[objects.id].pos[0].x = object.left;
                    layer.object[objects.id].pos[0].y = object.top;
                    layer.object[objects.id].angle = object.angle;
                }
            }

            myCanvas.renderAll();
            return;
        },


        'mouse:over': (e) => {

            try {
                if (
                    editorMode === 'area-translation' ||
                    editorMode === 'area-remove-drag' ||
                    editorMode === 'area-remove-brush' ||
                    editorMode === 'area-recovery-drag' ||
                    editorMode === 'area-recovery-brush' ||
                    editorMode === 'crop'
                ) {
                    return;
                }

                e.target.set('backgroundColor', 'rgba(41, 136, 255, 0.5)');

                myCanvas.renderAll();
            } catch (e) {
                //
            }

        },

        'mouse:out': (e) => {
            try {
                if (
                    editorMode === 'area-translation' ||
                    editorMode === 'area-remove-drag' ||
                    editorMode === 'area-remove-brush' ||
                    editorMode === 'area-recovery-drag' ||
                    editorMode === 'area-recovery-brush' ||
                    editorMode === 'crop'
                ) {
                    return;
                }

                let layer = getCurrentLayer();
                let color = layer.object[e.target.id].background;


                if (layer.object[e.target.id].object === 'i-text') {
                    if (color) {
                        e.target.set('backgroundColor', `rgb(${color.R}, ${color.G}, ${color.B})`);
                    } else {
                        e.target.set('backgroundColor', `transparent`);
                    }
                } else {
                    if (color) {
                        e.target.set('backgroundColor', `transparent`);
                    }
                }

                myCanvas.renderAll();

            } catch (e) {
                //
            }
        },

        'mouse:down': async (e) => {
            isDrag = true;

            areaPos['x'] = [e.absolutePointer.x];
            areaPos['y'] = [e.absolutePointer.y];

            let layer = getCurrentLayer();

            switch (editorMode) {
                case "area-recovery-drag": {
                    let dragArea = await mergeImage(layer.image.origin);

                    dragImage = new fabric.Image(dragArea);
                    dragImage.set({
                        visible: false
                    });

                    myCanvas.add(dragImage);

                    break;
                }

                case "area-recovery-brush": {
                    let dragArea = await mergeImage(layer.image.origin);

                    dragImage = new fabric.Image(dragArea);
                    dragImage.set({
                        visible: false
                    });

                    myCanvas.add(dragImage);

                    break;
                }

                default: break;
            }
        },

        'mouse:move': async (e) => {
            if (!isDrag) {
                return;
            }

            switch (editorMode) {
                case "area-recovery-drag": {
                    let test = {
                        x: [],
                        y: []
                    };

                    test['x'].push(areaPos['x'][0]);
                    test['y'].push(areaPos['y'][0]);
                    test['x'].push(e.absolutePointer.x);
                    test['y'].push(e.absolutePointer.y);

                    let xMax = Math.max(...test['x']);
                    let xMin = Math.min(...test['x']);
                    let yMax = Math.max(...test['y']);
                    let yMin = Math.min(...test['y']);

                    let rect = new fabric.Rect({
                        left: xMin - (dragImage.width / 2),
                        top: yMin - (dragImage.height / 2),
                        width: xMax - xMin,
                        height: yMax - yMin,
                    });

                    dragImage.set({
                        clipPath: rect,
                        selectable: false,
                        visible: true
                    });

                    myCanvas.renderAll();

                    break;
                }

                default: break;
            }
        },

        'mouse:up': async (e) => {
            isDrag = false;

            switch (editorMode) {
                case "area-translation": {
                    loading.style.display = "";

                    areaPos['x'].push(e.absolutePointer.x);
                    areaPos['y'].push(e.absolutePointer.y);

                    let xMax = Math.max(...areaPos['x']);
                    let xMin = Math.min(...areaPos['x']);
                    let yMax = Math.max(...areaPos['y']);
                    let yMin = Math.min(...areaPos['y']);

                    let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

                    myCanvas.zoomToPoint(new fabric.Point(0, 0), 1.0);

                    let data = myCanvas.toDataURL({
                        left: xMin,
                        top: yMin,
                        width: xMax - xMin,
                        height: yMax - yMin,
                    });

                    myCanvas.zoomToPoint(new fabric.Point(0, 0), percentage / 100);

                    await processVisionData({
                        image: data,

                        pos: {
                            x: xMin,
                            y: yMin
                        }
                    });

                    await toggleToolbar(areaRemove, "area-translation");
                    await saveCanvas();

                    loading.style.display = "none";

                    floatingToast(`번역이 완료되었습니다.`, 'inform');

                    break;
                }

                case "area-remove-drag": {
                    loading.style.display = "";

                    areaPos['x'].push(e.absolutePointer.x);
                    areaPos['y'].push(e.absolutePointer.y);

                    let xMax = Math.max(...areaPos['x']);
                    let xMin = Math.min(...areaPos['x']);
                    let yMax = Math.max(...areaPos['y']);
                    let yMin = Math.min(...areaPos['y']);

                    let rect = new fabric.Rect({
                        left: xMin,
                        top: yMin,
                        width: xMax - xMin,
                        height: yMax - yMin,
                        fill: `white`,
                    });

                    await getMaskImage([rect]);
                    await toggleToolbar(areaRemove, "area-remove-drag");
                    await saveCanvas();

                    loading.style.display = "none";

                    floatingToast(`잔상을 제거했습니다.`, 'inform');

                    break;
                }

                case "area-remove-brush": {
                    loading.style.display = "";

                    let objects = myCanvas.getObjects().filter((v) => {
                        let type = v.get('type');

                        if (type !== 'path') {
                            return false;
                        }

                        return true;
                    })

                    await getMaskImage(objects);
                    await toggleToolbar(areaRemove, "area-remove-brush");
                    await saveCanvas();

                    loading.style.display = "none";

                    floatingToast(`잔상을 제거했습니다.`, 'inform');

                    break;
                }

                case "area-recovery-drag": {
                    let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

                    loading.style.display = "";

                    areaPos['x'].push(e.absolutePointer.x);
                    areaPos['y'].push(e.absolutePointer.y);

                    let xMax = Math.max(...areaPos['x']);
                    let xMin = Math.min(...areaPos['x']);
                    let yMax = Math.max(...areaPos['y']);
                    let yMin = Math.min(...areaPos['y']);

                    let layer = getCurrentLayer();

                    let originArea = await mergeImage(layer.image.current);
                    let originImage = new fabric.Image(originArea);

                    let clipArea = await mergeImage(layer.image.origin);
                    let clipImage = new fabric.Image(clipArea);

                    let rect = new fabric.Rect({
                        left: xMin - (clipImage.width / 2),
                        top: yMin - (clipImage.height / 2),
                        width: xMax - xMin,
                        height: yMax - yMin,
                    });

                    clipImage.set({
                        clipPath: rect,
                        selectable: false
                    });

                    myCanvas.clear();

                    myCanvas.add(originImage);
                    myCanvas.add(clipImage);

                    myCanvas.zoomToPoint(new fabric.Point(0, 0), 1.0);

                    myCanvas.setDimensions({
                        width: myCanvas.width * (100 / percentage),
                        height: myCanvas.height * (100 / percentage),
                    });

                    let dataUrl = myCanvas.toDataURL();

                    layer.image.current = dataUrl;

                    await displayImage(currentImageIndex);
                    await toggleToolbar(areaRecovery, "area-recovery-drag");
                    await saveCanvas();

                    loading.style.display = "none";

                    floatingToast(`영역이 복구되었습니다.`, 'inform');

                    break;
                }

                case "area-recovery-brush": {
                    let percentage = Math.round(parseInt(previewSize.value) / 10) * 10 + 10;

                    loading.style.display = "";

                    areaPos['x'].push(e.absolutePointer.x);
                    areaPos['y'].push(e.absolutePointer.y);

                    let xMin = Math.min(...areaPos['x']);
                    let yMin = Math.min(...areaPos['y']);

                    let layer = getCurrentLayer();

                    let originArea = await mergeImage(layer.image.current);
                    let originImage = new fabric.Image(originArea);

                    let clipArea = await mergeImage(layer.image.origin);
                    let clipImage = new fabric.Image(clipArea);

                    let objects = myCanvas.getObjects().filter((v) => {
                        let type = v.get('type');

                        if (type !== 'path') {
                            return false;
                        }

                        myCanvas.remove(v);

                        return true;
                    });

                    let paths = new fabric.Group(objects, {
                        left: xMin - (clipImage.width / 2) - 25,
                        top: yMin - (clipImage.height / 2) - 25,
                    });

                    clipImage.set({
                        clipPath: paths,
                        selectable: false
                    });

                    myCanvas.clear();

                    myCanvas.add(originImage);
                    myCanvas.add(clipImage);

                    myCanvas.zoomToPoint(new fabric.Point(0, 0), 1.0);
                    myCanvas.setDimensions({
                        width: myCanvas.width * (100 / percentage),
                        height: myCanvas.height * (100 / percentage),
                    });

                    let dataUrl = myCanvas.toDataURL();

                    layer.image.current = dataUrl;

                    await displayImage(currentImageIndex);
                    await toggleToolbar(areaRecovery, "area-recovery-brush");
                    await saveCanvas();

                    loading.style.display = "none";

                    floatingToast(`영역이 복구되었습니다.`, 'inform');

                    break;
                }

                default: break;
            }
        }
    });
};

function isValidUser() {
    if (appData.user.rank !== "basic") {
        return true;
    }

    let caculated = parseInt(appData.user.usage) - 1;

    if (caculated < 0) {
        return false;
    }

    appData.user.usageTemp = caculated.toString();

    return true;
}

async function setUserCredit() {
    if (appData.user.rank !== "basic") {
        return true;
    }

    let usageResp = await fetch(FLASK_URL + "setusage", {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify({
            id: appData.user.id,
            usage: appData.user.usageTemp,
        }),

        method: "POST"
    });

    let usageText = await usageResp.text();

    appData.user.usage = usageText;
    userCredit.innerHTML = usageText;

    return true;
}

async function setTextFont(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            layer.object[object.id].textOption.font = e.target.value;
            layer.object[object.id].text.set({
                fontFamily: e.target.value
            });
        }
    } else {
        layer.object[objects.id].textOption.font = e.target.value;
        layer.object[objects.id].text.set({
            fontFamily: e.target.value
        });
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextSize(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {

                layer.object[object.id].textOption.size = parseInt(e.target.value);
                layer.object[object.id].text.set({
                    fontSize: parseInt(e.target.value)
                });
            }
        }
    } else {
        layer.object[objects.id].textOption.size = parseInt(e.target.value);
        layer.object[objects.id].text.set({
            fontSize: parseInt(e.target.value)
        });
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextColor(e) {
    let color = hexToRgb(e.target.value);
    let objects = myCanvas.getActiveObject();

    if (!objects) {
        return;
    }

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == "i-text") {
                layer.object[object.id].foreground = {
                    'R': color.r,
                    'G': color.g,
                    'B': color.b
                };

                object.set({
                    fill: e.target.value
                });
            }
        }
    } else {
        layer.object[objects.id].foreground = {
            'R': color.r,
            'G': color.g,
            'B': color.b
        };

        objects.set({
            fill: e.target.value
        });
    }

    myCanvas.renderAll();
}

async function setTextBackground(e) {
    let color = hexToRgb(e.target.value);
    let objects = myCanvas.getActiveObject();

    if (!objects) {
        return;
    }

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {
                layer.object[object.id].background = {
                    'R': color.r,
                    'G': color.g,
                    'B': color.b
                };

                object.set({
                    backgroundColor: e.target.value
                });
            }
        }
    } else {
        layer.object[objects.id].background = {
            'R': color.r,
            'G': color.g,
            'B': color.b
        };

        objects.set({
            backgroundColor: e.target.value
        });
    }

    myCanvas.renderAll();
}

async function setShapeColor(e) {
    let color = hexToRgb(e.target.value);
    let objects = myCanvas.getActiveObject();

    if (!objects) {
        return;
    }

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == "rect") {
                layer.object[object.id].foreground = {
                    'R': color.r,
                    'G': color.g,
                    'B': color.b
                };

                object.set({
                    stroke: `rgb(${color.r}, ${color.g}, ${color.b})`,
                });
            }
        }
    } else {
        layer.object[objects.id].foreground = {
            'R': color.r,
            'G': color.g,
            'B': color.b
        };

        objects.set({
            stroke: `rgb(${color.r}, ${color.g}, ${color.b})`,
        });
    }

    myCanvas.renderAll();
}

async function setShapeStrokeWidth(e) {
    let objects = myCanvas.getActiveObject();
    let layer = getCurrentLayer();

    if (!objects) {
        return;
    }

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'rect') {

                layer.object[object.id].shapeOption.strokeWidth = parseInt(e.target.value);

                object.set({
                    strokeWidth: parseInt(e.target.value),
                });
            }
        }
    } else {
        layer.object[objects.id].shapeOption.strokeWidth = parseInt(e.target.value);

        objects.set({
            strokeWidth: parseInt(e.target.value),
        });
    }
    myCanvas.renderAll();
}

async function setShapeStrokeShape(e) {
    let objects = myCanvas.getActiveObject();
    let layer = getCurrentLayer();

    if (!objects) {
        return;
    }

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'rect') {

                layer.object[object.id].shapeOption.rx = parseInt(e.target.value);
                layer.object[object.id].shapeOption.ry = parseInt(e.target.value);

                object.set({
                    rx: parseInt(e.target.value),
                    ry: parseInt(e.target.value),
                });
            }
        }
    } else {
        layer.object[objects.id].shapeOption.rx = parseInt(e.target.value);
        layer.object[objects.id].shapeOption.ry = parseInt(e.target.value);


        objects.set({
            rx: parseInt(e.target.value),
            ry: parseInt(e.target.value),
        });
    }
    myCanvas.renderAll();
}


async function setShapeBackground(e) {
    let color = hexToRgb(e.target.value);
    let objects = myCanvas.getActiveObject();

    if (!objects) {
        return;
    }

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == "rect") {

                layer.object[object.id].background = {
                    'R': color.r,
                    'G': color.g,
                    'B': color.b
                };

                object.set({
                    fill: e.target.value
                });
            }
        }
    } else {
        layer.object[objects.id].background = {
            'R': color.r,
            'G': color.g,
            'B': color.b
        };

        objects.set({
            fill: e.target.value
        });
    }

    myCanvas.renderAll();
}

async function setTextBold(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {
                layer.object[object.id].textOption.bold = e.target.checked ? "bold" : "normal";
                layer.object[object.id].text.set({
                    fontWeight: e.target.checked ? "bold" : "normal"
                });
            }
        }
    } else {
        layer.object[objects.id].textOption.bold = e.target.checked ? "bold" : "normal";
        layer.object[objects.id].text.set({
            fontWeight: e.target.checked ? "bold" : "normal"
        });
    }

    if (e.target.checked) {
        e.target.parentNode.style.color = "rgb(41, 136, 255)";
    } else {
        e.target.parentNode.style.color = "white";
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextItalic(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {
                layer.object[object.id].textOption.italic = e.target.checked ? "italic" : "normal";
                layer.object[object.id].text.set({
                    fontStyle: e.target.checked ? "italic" : "normal"
                });
            }
        }
    } else {
        layer.object[objects.id].textOption.italic = e.target.checked ? "italic" : "normal";
        layer.object[objects.id].text.set({
            fontStyle: e.target.checked ? "italic" : "normal"
        });
    }

    if (e.target.checked) {
        e.target.parentNode.style.color = "rgb(41, 136, 255)";
    } else {
        e.target.parentNode.style.color = "white";
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextLineThrough(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {
                layer.object[object.id].textOption.lineThrough = e.target.checked ? "lineThrough" : "normal";
                layer.object[object.id].text.set({
                    linethrough: e.target.checked
                });
            }
        }
    } else {
        layer.object[objects.id].textOption.lineThrough = e.target.checked ? "lineThrough" : "normal";
        layer.object[objects.id].text.set({
            linethrough: e.target.checked
        });
    }

    if (e.target.checked) {
        e.target.parentNode.style.color = "rgb(41, 136, 255)";
    } else {
        e.target.parentNode.style.color = "white";
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextUnderLine(e) {
    let objects = myCanvas.getActiveObject();

    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[object.id].object == 'i-text') {
                layer.object[object.id].textOption.underLine = e.target.checked ? "underLine" : "normal";
                layer.object[object.id].text.set({
                    underline: e.target.checked
                });
            }
        }
    } else {
        layer.object[objects.id].textOption.underLine = e.target.checked ? "underLine" : "normal";
        layer.object[objects.id].text.set({
            underline: e.target.checked
        });
    }

    if (e.target.checked) {
        e.target.parentNode.style.color = "rgb(41, 136, 255)";
    } else {
        e.target.parentNode.style.color = "white";
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setTextAlign(direction) {
    let objects = myCanvas.getActiveObject();
    let layer = getCurrentLayer();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            if (layer.object[i].object == 'i-text') {
                switch (direction) {
                    case "left": {
                        object.set({
                            textAlign: direction
                        });

                        break;
                    }

                    case "center": {
                        object.set({
                            textAlign: direction
                        });

                        break;
                    }

                    case "right": {
                        object.set({
                            textAlign: direction
                        });

                        break;
                    }

                    default: break;
                }
            }
        }

    } else {
        switch (direction) {
            case "left": {
                objects.set({
                    textAlign: direction
                });

                break;
            }

            case "center": {
                objects.set({
                    textAlign: direction
                });

                break;
            }

            case "right": {
                objects.set({
                    textAlign: direction
                });

                break;
            }

            default: break;
        }
    }

    myCanvas.renderAll();

    await saveCanvas();
}

async function setGroupAlign(direction) {
    let objects = myCanvas.getActiveObject();

    if (objects['_objects']) {
        for (let i in objects['_objects']) {
            let object = objects['_objects'][i];

            switch (direction) {
                case "left": {
                    object.set({
                        left: 0 - (objects.width / 2)
                    });

                    break;
                }

                case "center": {
                    object.set({
                        left: 0 - (object.width / 2)
                    });

                    break;
                }

                case "right": {
                    object.set({
                        left: (objects.width / 2) - object.width
                    });

                    break;
                }

                case "top": {
                    object.set({
                        top: 0 - (objects.height / 2)
                    });

                    break;
                }

                case "middle": {
                    object.set({
                        top: 0 - (object.height / 2)
                    });

                    break;
                }

                case "bottom": {
                    object.set({
                        top: (objects.height / 2) - object.height
                    });

                    break;
                }

                default: break;
            }
        }
    }

    myCanvas.renderAll();

    await saveCanvas();
}

function toggleInit(mode) {
    switch (mode) {
        case "area-translation": {
            startRegion.disabled = false;
            endRegion.disabled = false;

            break;
        }

        case "area-remove-drag": {
            areaRemoveSelect.style.display = "none";

            break;
        }

        case "area-remove-brush": {
            areaRemoveSelect.style.display = "none";

            myCanvas.isDrawingMode = false;

            break;
        }

        case "area-recovery-drag": {
            areaRecoverySelect.style.display = "none";

            break;
        }

        case "area-recovery-brush": {
            areaRecoverySelect.style.display = "none";

            myCanvas.isDrawingMode = false;

            break;
        }


        case "select-thumbnail": {
            selectTranslationSelect.style.display = "none";

            break;
        }

        case "select-option": {
            selectTranslationSelect.style.display = "none";

            break;
        }

        case "select-detail": {
            selectTranslationSelect.style.display = "none";

            break;
        }

        case "crop": {
            mainCrop.style.display = "none";
            mainTextEditor.style.display = "";

            break;
        }

        case "watermark": {
            mainWaterMark.style.display = "none";
            mainTextEditor.style.display = "";

            break;
        }

        case "download": {
            mainDownload.style.display = "none";

            originWidthPCLayout.style.display = "none";
            originWidthURLLayout.style.display = "none";

            break;
        }

        default: break;
    }
}

async function toggleToolbar(element, mode) {
    let buttons = document.getElementsByClassName('toolbar');
    for (let i = 0; i < buttons.length; i++) {
        if (element.getAttribute('key') === buttons[i].getAttribute('key')) {
            if (editorMode === mode) {
                editorMode = 'idle';
                buttons[i].className = "toolbar button default btnTooltip";

                toggleInit(mode);
            } else {
                if (editorMode !== 'idle') {
                    toggleInit(editorMode);
                }

                switch (mode) {
                    case "area-remove-drag": {
                        removeType = mode;

                        areaRemove.innerHTML = `<span class="btnKeys_top">Shift + 4</span> <img src="../icons/17eraserdrag.svg" alt="" width="34px" />`;
                        areaRemoveSelect.style.display = "none";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "area-remove-brush": {
                        removeType = mode;

                        areaRemove.innerHTML = `<span class="btnKeys_top">Shift + 4</span> <img src="../icons/18eraserbrush.svg" alt="" width="34px" />`;
                        areaRemoveSelect.style.display = "none";

                        myCanvas.isDrawingMode = true;
                        myCanvas.freeDrawingBrush.width = 50;
                        myCanvas.freeDrawingBrush.color = "white";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "area-recovery-drag": {
                        recoveryType = mode;

                        areaRecovery.innerHTML = `<span class="btnKeys_top">Shift + 5</span> <img src="../icons/19restoredrag.svg" alt="" width="34px" />`;
                        areaRecoverySelect.style.display = "none";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "area-recovery-brush": {
                        recoveryType = mode;

                        areaRecovery.innerHTML = `<span class="btnKeys_top">Shift + 5</span> <img src="../icons/20restorebrush.svg" alt="" width="34px" />`;
                        areaRecoverySelect.style.display = "none";

                        myCanvas.isDrawingMode = true;
                        myCanvas.freeDrawingBrush.width = 50;
                        myCanvas.freeDrawingBrush.color = "white";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "area-translation": {

                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "crop": {
                        mainCrop.style.display = "";
                        mainTextEditor.style.display = "none";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "watermark": {
                        mainWaterMark.style.display = "";
                        mainTextEditor.style.display = "none";
                        buttons[i].className = "toolbar button primary btnTooltip";

                        break;
                    }

                    case "download": {
                        let accept = confirm("모든 이미지와 동영상이 동시에 저장됩니다.\n편집이 모두 완료되었는지 확인 후 저장해주세요.");

                        if (!accept) {
                            return;
                        }

                        mainDownload.style.display = "";

                        if (currentType === "0") {
                            originWidthPCLayout.style.display = "";
                            originWidthURLLayout.style.display = "none";
                        } else {
                            originWidthPCLayout.style.display = "none";
                            originWidthURLLayout.style.display = "";
                        }

                        break;
                    }

                    default: break;
                }

                editorMode = mode;

            }

            continue;
        }

        buttons[i].className = "toolbar button default btnTooltip";
    }

    await displayImage(currentImageIndex);
}

async function addShape() {
    let color = {
        r: 0,
        g: 0,
        b: 0
    }

    let info = {
        "object": "rect",

        "pos": [
            {
                "x": 0,
                "y": 0
            },
            {
                "x": 150,
                "y": 0
            },
            {
                "x": 150,
                "y": 150
            },
            {
                "x": 0,
                "y": 150
            }
        ],

        "background": isShapeFill ? {
            "B": color.b,
            "G": color.g,
            "R": color.r
        } : undefined,

        "shapeOption": {
            "strokeWidth": 0,
            "rx": 0,
            "ry": 0,
        },

    };

    let layer = getCurrentLayer();

    layer.object.push(info);

    await displayImage(currentImageIndex);
    await saveCanvas();
}

async function addText() {
    let color = hexToRgb(toolTextColor.value);

    let info = {
        "object": "i-text",

        "pos": [
            {
                "x": 0,
                "y": 0
            },
            {
                "x": 300,
                "y": 0
            },
            {
                "x": 300,
                "y": 300
            },
            {
                "x": 0,
                "y": 300
            }
        ],

        "original": "",
        "translated": "텍스트를 입력해주세요.",

        "textOption": {
            "font": "NNSQUAREROUNDR",
            "size": 50,
            "bold": "normal",
            "italic": "normal",
            "lineThrough": "",
            "underLine": ""
        },


        "foreground": {
            "B": 0,
            "G": 0,
            "R": 0
        },

    };

    let layer = getCurrentLayer();
    layer.object.push(info);

    await displayImage(currentImageIndex);
    await saveCanvas();
}

async function addTextVertical() {
    let info = {
        "object": "i-text",

        "pos": [
            {
                "x": 0,
                "y": 0
            },
            {
                "x": 300,
                "y": 0
            },
            {
                "x": 300,
                "y": 300
            },
            {
                "x": 0,
                "y": 300
            }
        ],

        "original": "",
        "translated": "텍\n스\n트\n를\n입\n력\n해\n주\n세\n요",
        
        "textOption": {
            "font": "NNSQUAREROUNDR",
            "size": 50,
            "bold": "normal",
            "italic": "normal",
            "lineThrough": "",
            "underLine": "",
            "direction": "vertical",
        },
        
        
        "foreground":{
            "B": 0,
            "G": 0,
            "R": 0
        },

    };

    let layer = getCurrentLayer();
    layer.object.push(info);

    await displayImage(currentImageIndex);
    await saveCanvas();
}

function imageToolHelper() {
    let radioList = document.getElementsByName('cropRatioType');

    for (let i = 0; i < radioList.length; i++) {
        radioList[i].addEventListener('change', (e) => {
            for (let j = 0; j < radioList.length; j++) {
                if (e.target.value === radioList[j].value) {
                    radioList[j].parentNode.className = "radio activated";

                    cropRatioType = e.target.value;

                    displayImage(currentImageIndex);
                } else {
                    radioList[j].parentNode.className = "radio default";
                }
            }
        });
    }

    textTranslated.addEventListener('keyup', (e) => {
        let objects = myCanvas.getActiveObject();

        let layer = getCurrentLayer();

        if (objects) {
            if (objects['_objects']) {
                for (let i in objects['_objects']) {
                    let object = objects['_objects'][i];
                    let objectType = object.get('type');
                    let objectDirection = layer.object[object.id].textOption.direction;

                    switch (objectType) {
                        case "i-text": {
                            if(objectDirection == "vertical"){
                                layer.object[object.id].translated = e.target.value;
                                layer.object[object.id].text.set({
                                    text: e.target.value.match(/.{1}/g).join("\n")
                                });
                            } else {
                                layer.object[object.id].translated = e.target.value;
                                layer.object[object.id].text.set({
                                    text: e.target.value
                                });
                            }
                    
                            break;
                        }

                        default: break;
                    }
                }
            } else {
                let objectType = objects.get('type');
                let objectDirection = layer.object[objects.id].textOption.direction;

                switch (objectType) {
                    case "i-text": {
                        if(objectDirection == "vertical"){
                            layer.object[objects.id].translated = e.target.value;
                            layer.object[objects.id].text.set({
                                text: e.target.value.match(/.{1}/g).join("\n")
                            });
                        } else {
                            layer.object[objects.id].translated = e.target.value;
                            layer.object[objects.id].text.set({
                                text: e.target.value
                            });
                        }
                        
                        break;
                    }

                    default: break;
                }
            }

            myCanvas.renderAll();
        }
    });

    function setTextTab() {
        let objects = myCanvas.getActiveObject();
        let layer = getCurrentLayer();
        let length = Object.keys(objects['_objects']).length;

        if (objects['_objects']) {
            for (let i = 0; i < length; i++) {
                if (objects['_objects'][i].text) {
                    textTab.style.backgroundColor = "rgb(80, 80, 80)";
                    shapeTab.style.backgroundColor = "rgb(65, 65, 65)";
                    fixedTextTool.style.display = "";
                    fixedShapeTool.style.display = "none";
                }
            }
        } else {
            if (layer.object[objects.id].object == 'i-text') {
                textTab.style.backgroundColor = "rgb(80, 80, 80)";
                shapeTab.style.backgroundColor = "rgb(65, 65, 65)";
                fixedTextTool.style.display = "";
                fixedShapeTool.style.display = "none";
            }
        }
    }

    function setShapeTab() {
        let objects = myCanvas.getActiveObject();
        let layer = getCurrentLayer();
        let length = Object.keys(objects['_objects']).length;

        if (objects['_objects']) {
            for (let i = 0; i < length; i++) {
                if (objects['_objects'][i].stroke) {
                    textTab.style.backgroundColor = "rgb(65, 65, 65)";
                    shapeTab.style.backgroundColor = "rgb(80, 80, 80)";
                    fixedTextTool.style.display = "none";
                    fixedShapeTool.style.display = "";
                }
            }
        } else {
            if (layer.object[objects.id].object == 'rect') {
                textTab.style.backgroundColor = "rgb(65, 65, 65)";
                shapeTab.style.backgroundColor = "rgb(80, 80, 80)";
                fixedTextTool.style.display = "none";
                fixedShapeTool.style.display = "";
            }
        }
    }

    pageTitle.addEventListener('click', () => {
        window.location.href = "./app.html";
    });

    mainImg.addEventListener('click', () => {
        window.location.href = "./app.html";
    });

    multipleTranslation.addEventListener('click', multiple);
    singleTranslation.addEventListener('click', single);

    previewZoomOut.addEventListener('click', zoomOut);
    previewZoomIn.addEventListener('click', zoomIn);

    areaTranslation.addEventListener('click', () => toggleToolbar(areaTranslation, 'area-translation'));

    imageRecovery.addEventListener('click', recovery);
    imageExit.addEventListener('click', exit);
    imageTemp.addEventListener("click", temp);

    textTab.addEventListener('click', setTextTab);
    shapeTab.addEventListener('click', setShapeTab);

    areaRemoveDrag.addEventListener('click', () => toggleToolbar(areaRemove, 'area-remove-drag'));
    areaRemoveBrush.addEventListener('click', () => toggleToolbar(areaRemove, 'area-remove-brush'));
    areaRemove.addEventListener('click', () => toggleToolbar(areaRemove, removeType));
    areaRemoveType.addEventListener('click', () => {
        if (areaRemoveSelect.style.display === "") {
            areaRemoveSelect.style.display = "none";
        } else {
            areaRemoveSelect.style.display = "";
        }

        areaRecoverySelect.style.display = "none";
        shapeSelect.style.display = "none";
        selectTranslationSelect.style.display = "none";
        textSelect.style.display = "none";

    });


    areaRecoveryDrag.addEventListener('click', () => toggleToolbar(areaRecovery, 'area-recovery-drag'));
    areaRecoveryBrush.addEventListener('click', () => toggleToolbar(areaRecovery, 'area-recovery-brush'));
    areaRecovery.addEventListener('click', () => toggleToolbar(areaRecovery, recoveryType));
    areaRecoveryType.addEventListener('click', () => {
        if (areaRecoverySelect.style.display === "") {
            areaRecoverySelect.style.display = "none";
        } else {
            areaRecoverySelect.style.display = "";
        }

        areaRemoveSelect.style.display = "none";
        shapeSelect.style.display = "none";
        selectTranslationSelect.style.display = "none";
        textSelect.style.display = "none";

    });

    thumbnailButton.addEventListener('click', thumbnail);
    optionButton.addEventListener('click', option);
    detailButton.addEventListener('click', detail);
    multipleTranslation.addEventListener('click', () => toggleToolbar(multipleTranslation, selectType));
    selectTranslationType.addEventListener('click', () => {
        if (selectTranslationSelect.style.display === "") {
            selectTranslationSelect.style.display = "none";
        } else {
            selectTranslationSelect.style.display = "";
        }

        areaRecoverySelect.style.display = "none";
        areaRemoveSelect.style.display = "none";
        shapeSelect.style.display = "none";
    });

    cropStart.addEventListener('click', () => toggleToolbar(cropStart, 'crop'));
    cropCancel.addEventListener('click', () => toggleToolbar(cropStart, 'crop'));
    cropAccept.addEventListener('click', async () => {
        let croppedWidth = cropRectangle.width * cropRectangle.scaleX;
        let croppedHeight = cropRectangle.height * cropRectangle.scaleY;

        myCanvas.zoomToPoint(new fabric.Point(0, 0), 1.0);

        let dataUrl = myCanvas.toDataURL({
            left: cropRectangle.left,
            top: cropRectangle.top,
            width: croppedWidth,
            height: croppedHeight,
            globalCompositeOperation: "source-over"
        });

        let layer = getCurrentLayer();

        layer.image.current = dataUrl;

        await toggleToolbar(cropStart, 'crop');
        await saveCanvas();

        floatingToast(`변경사항이 저장되었습니다.`, 'success');
    });

    shapeFill.addEventListener('click', () => {
        isShapeFill = true;
        shapeSelect.style.display = "none";

        shapeStart.innerHTML = `<img src="../icons/08figurebox.svg" alt="" width="34px" />`;

        addShape();
    });

    shapeStart.addEventListener('click', () => addShape());
    shapeType.addEventListener('click', () => {
        if (shapeSelect.style.display === "") {
            shapeSelect.style.display = "none";
        } else {
            shapeSelect.style.display = "";
        }

        areaRemoveSelect.style.display = "none";
        areaRecoverySelect.style.display = "none";
        textSelect.style.display = "none";
    });

    textStart.addEventListener('click', async () => {
        addText();
        textSelect.style.display = "none";
    });

    textType.addEventListener('click', () => {
        if (textSelect.style.display === "") {
            textSelect.style.display = "none";
        } else {
            textSelect.style.display = "";
        }

        areaRemoveSelect.style.display = "none";
        areaRecoverySelect.style.display = "none";
        shapeSelect.style.display = "none";
    });

    horizontal.addEventListener('click', async () => {
        addText();
        textSelect.style.display = "none";
    });

    vertical.addEventListener('click', async () => {
        addTextVertical();
        textSelect.style.display = "none";
    });

    alignLeft.addEventListener('click', () => setGroupAlign('left'));
    alignCenter.addEventListener('click', () => setGroupAlign('center'));
    alignRight.addEventListener('click', () => setGroupAlign('right'));
    alignTop.addEventListener('click', () => setGroupAlign('top'));
    alignMiddle.addEventListener('click', () => setGroupAlign('middle'));
    alignBottom.addEventListener('click', () => setGroupAlign('bottom'));

    playOriginal.addEventListener('mousedown', (e) => {
        isOriginal = true;
        displayImage(currentImageIndex);
    });

    playOriginal.addEventListener('mouseup', (e) => {
        isOriginal = false;

        displayImage(currentImageIndex);
    });

    previewSize.addEventListener('input', (e) => {
        displayImage(currentImageIndex);
    });


    // previewZoomOut.addEventListener('click', () => {
    //     let percentage = parseInt(previewSize.value);

    //     if (percentage - 10 < 0) {
    //         percentage = 0;
    //     } else {
    //         percentage = percentage - 10;
    //     }

    //     previewSize.value = percentage;

    //     displayImage(currentImageIndex);
    // });

    // previewZoomIn.addEventListener('click', (e) => {
    //     let percentage = parseInt(previewSize.value);
    //     if (percentage + 10 > 200) {
    //         percentage = 200;
    //     } else {
    //         percentage = percentage + 10;
    //     }

    //     previewSize.value = percentage;

    //     displayImage(currentImageIndex);
    // });

    playUndo.addEventListener('click', () => {
        replayCanvas("undo");
    });

    playRedo.addEventListener('click', () => {
        replayCanvas("redo");
    });

    displayDouble.addEventListener('click', () => {
        if (doubleFrame.style.display === "none") {
            displayDouble.innerHTML = `<img src="../icons/27double.svg" alt="" width="34px" />`;

            doubleFrame.style.display = "";
            doubleBorder.style.display = "";
        } else {
            displayDouble.innerHTML = `<img src="../icons/26single.svg" alt="" width="34px" />`;

            doubleFrame.style.display = "none";
            doubleBorder.style.display = "none";
        }
    });

    btnSetting.addEventListener('click', () => {
        setting.style.display = "";
    });

    applyWaterMarkText.addEventListener("keyup", (e) => {
        saveLocalSettings("waterMarkText", e.target.value);

        displayImage(currentImageIndex);
    });

    applyWaterMarkOpacity.addEventListener("change", (e) => {
        saveLocalSettings("waterMarkOpacity", e.target.value);

        displayImage(currentImageIndex);
    });

    applyOriginWidthPC.addEventListener('change', (e) => {
        saveLocalSettings("originWidthPC", e.target.value);

        if (e.target.value === 'Y') {
            originWidthPC.disabled = true;
        } else {
            originWidthPC.disabled = false;
        }
    });

    originWidthPC.addEventListener('change', (e) => {
        saveLocalSettings("originWidthPCSize", e.target.value);
    });

    applyOriginWidthThumbnail.addEventListener('change', (e) => {
        saveLocalSettings("originWidthThumbnail", e.target.value);

        if (e.target.value === 'Y') {
            originWidthThumbnail.disabled = true;
        } else {
            originWidthThumbnail.disabled = false;
        }
    });

    originWidthThumbnail.addEventListener('change', (e) => {
        saveLocalSettings("originWidthThumbnailSize", e.target.value);
    });

    applyOriginWidthOption.addEventListener('change', (e) => {
        saveLocalSettings("originWidthOption", e.target.value);

        if (e.target.value === 'Y') {
            originWidthOption.disabled = true;
        } else {
            originWidthOption.disabled = false;
        }
    });

    originWidthOption.addEventListener('change', (e) => {
        saveLocalSettings("originWidthOptionSize", e.target.value);
    });

    applyOriginWidthDescription.addEventListener('change', (e) => {
        saveLocalSettings("originWidthDescription", e.target.value);

        if (e.target.value === 'Y') {
            originWidthDescription.disabled = true;
        } else {
            originWidthDescription.disabled = false;
        }
    });

    originWidthDescription.addEventListener('change', (e) => {
        saveLocalSettings("originWidthDescriptionSize", e.target.value);
    });

    applySensitive.addEventListener('change', (e) => {
        saveLocalSettings("originSensitive", e.target.value);
    });

    settingAccept.addEventListener('click', () => {
        setting.style.display = "none";
    })

    toolShapeOutlineColor.addEventListener('input', setShapeColor);
    toolShapeOutlineColor.addEventListener('change', () => { saveCanvas() });
    toolShapeStrokeWidth.addEventListener('input', setShapeStrokeWidth);
    toolShapeStrokeWidth.addEventListener('change', () => { saveCanvas() });
    toolShapeStrokeShape.addEventListener('input', setShapeStrokeShape);
    toolShapeStrokeShape.addEventListener('change', () => { saveCanvas() });
    toolShapeBackground.addEventListener('input', setShapeBackground);
    toolShapeBackground.addEventListener('change', () => { saveCanvas() });

    toolTextFont.addEventListener('change', setTextFont);
    toolTextSize.addEventListener('change', setTextSize);
    toolTextColor.addEventListener('input', setTextColor);
    toolTextColor.addEventListener('change', () => { saveCanvas() });
    toolTextBackground.addEventListener('input', setTextBackground);
    toolTextBackground.addEventListener('change', () => { saveCanvas() });
    toolTextBold.addEventListener('change', setTextBold);
    toolTextItalic.addEventListener('change', setTextItalic);
    toolTextLineThrough.addEventListener('change', setTextLineThrough);
    toolTextUnderLine.addEventListener('change', setTextUnderLine);
    toolTextAlignLeft.addEventListener('change', () => setTextAlign('left'));
    toolTextAlignCenter.addEventListener('change', () => setTextAlign('center'));
    toolTextAlignRight.addEventListener('change', () => setTextAlign('right'));

    fixedShapeOutlineColor.addEventListener('input', setShapeColor);
    fixedShapeOutlineColor.addEventListener('change', () => { saveCanvas() });
    fixedShapeStrokeWidth.addEventListener('input', setShapeStrokeWidth);
    fixedShapeStrokeWidth.addEventListener('change', () => { saveCanvas() });
    fixedShapeStrokeShape.addEventListener('input', setShapeStrokeShape);
    fixedShapeStrokeShape.addEventListener('change', () => { saveCanvas() });
    fixedShapeBackground.addEventListener('input', setShapeBackground);
    fixedShapeBackground.addEventListener('change', () => { saveCanvas() });

    fixedTextFont.addEventListener('change', setTextFont);
    fixedTextSize.addEventListener('change', setTextSize);
    fixedTextColor.addEventListener('input', setTextColor);
    fixedTextColor.addEventListener('change', () => { saveCanvas() });
    fixedTextBackground.addEventListener('input', setTextBackground);
    fixedTextBackground.addEventListener('change', () => { saveCanvas() });
    fixedTextBold.addEventListener('change', setTextBold);
    fixedTextItalic.addEventListener('change', setTextItalic);
    fixedTextLineThrough.addEventListener('change', setTextLineThrough);
    fixedTextUnderLine.addEventListener('change', setTextUnderLine);
    fixedTextAlignLeft.addEventListener('change', () => setTextAlign('left'));
    fixedTextAlignCenter.addEventListener('change', () => setTextAlign('center'));
    fixedTextAlignRight.addEventListener('change', () => setTextAlign('right'));

    floatingTextToolDragger.addEventListener('drag', async (e) => {
        if (e.x === 0 && e.y === 0) {
            return;
        }

        floatingTextTool.style.left = `${e.x + 224}px`;
        floatingTextTool.style.top = `${e.y + 52}px`;
    });

    floatingShapeToolDragger.addEventListener('drag', async (e) => {
        if (e.x === 0 && e.y === 0) {
            return;
        }

        floatingShapeTool.style.left = `${e.x + 103}px`;
        floatingShapeTool.style.top = `${e.y + 52}px`;
    });


    imageSave.addEventListener("click", () => toggleToolbar(imageSave, "download"));
    saveCancel.addEventListener('click', () => toggleToolbar(imageSave, "download"));
    saveAccept.addEventListener('click', async () => {
        let now = getClock();

        for (let i = 0; i < layers.length; i++) {
            let accept = await isValidUser();

            if (!accept) {
                floatingToast(`결제 후 이용해주세요.`, 'failed');

                return;
            }

            if (layers[i].type !== currentType) {
                currentType = layers[i].type;

                let menuList = document.getElementsByClassName('menu');

                for (let i = 0; i < menuList.length; i++) {
                    if (menuList[i].getAttribute('key') === currentType) {
                        if (menuList[i].className === "menu") {
                            menuList[i].className = "menu selected";

                            await loadImageList();
                        }
                    } else {
                        menuList[i].className = "menu";
                    }
                }
            }

            let dataUrl = null;

            switch (currentType) {
                case "0": {
                    if (appData.settings.originWidthPC === "N") {
                        dataUrl = await displayImage(layers[i].index, appData.settings.originWidthPCSize);
                    } else {
                        dataUrl = await displayImage(layers[i].index);
                    }

                    break;
                }

                case "1": {
                    if (appData.settings.originWidthThumbnail === "N") {
                        dataUrl = await displayImage(layers[i].index, appData.settings.originWidthThumbnailSize);
                    } else {
                        dataUrl = await displayImage(layers[i].index);
                    }

                    break;
                }

                case "2": {
                    if (appData.settings.originWidthOption === "N") {
                        dataUrl = await displayImage(layers[i].index, appData.settings.originWidthOptionSize);
                    } else {
                        dataUrl = await displayImage(layers[i].index);
                    }

                    break;
                }

                case "3": {
                    if (appData.settings.originWidthDescription === "N") {
                        dataUrl = await displayImage(layers[i].index, appData.settings.originWidthDescriptionSize);
                    } else {
                        dataUrl = await displayImage(layers[i].index);
                    }

                    break;
                }

                default: break;
            }

            let dataPath = `트랜져스/${now.YY}${now.MM}${now.DD}_${now.hh}${now.mm}${now.ss}/`;

            let indexed = (parseInt(layers[i].index) + 1).toString().padStart(2, '0');

            if (isLocal) {
                dataPath += `image-${indexed}.png`;
            } else {
                switch (currentType) {
                    case "1": {
                        dataPath += `썸네일/thumb-${indexed}.png`;

                        break;
                    }

                    case "2": {
                        dataPath += `옵션/option-${indexed}.png`;

                        break;
                    }

                    case "3": {
                        dataPath += `상세페이지/detail-${indexed}.png`;

                        break;
                    }

                    default: break;
                }
            }

            chrome.downloads.download({ url: dataUrl, filename: dataPath, saveAs: false });

            let complete = await setUserCredit();

            if (!complete) {
                floatingToast(`처리 중 오류가 발생하였습니다.`, 'failed');

                return;
            }
        }

        let videoElement = document.getElementsByClassName('video-thumbnail');

        for (let i = 0; i < videoElement.length; i++) {
            chrome.downloads.download({ url: videoElement[i].src, filename: `트랜져스/${now.YY}${now.MM}${now.DD}_${now.hh}${now.mm}${now.ss}/동영상/video.mp4`, saveAs: false });
        }

        floatingToast(`모든 이미지가 PC에 저장되었습니다.`, 'success');
    });

    saveProject.addEventListener('click', (e) => {
        let accept = confirm("현재 작업 내용을 프로젝트 파일로 저장하시겠습니까? (메인 화면에서 [프로젝트 파일로 가져오기]를 통해 작업한 내용을 불러올 수 있습니다.)");

        if (!accept) {
            return;
        }

        let now = getClock();
        let filename = `${now.YY}${now.MM}${now.DD}_${now.hh}${now.mm}${now.ss}`;

        let blob = new Blob([JSON.stringify({ layers, isLocal, uploadImages, now })], { type: "application/project" });
        let url = URL.createObjectURL(blob);

        chrome.downloads.download({ url: url, filename: `트랜져스/프로젝트/${filename}.project`, saveAs: false });
    });

}

async function zoomOut() {
    let percentage = parseInt(previewSize.value);

    if (percentage - 10 < 0) {
        percentage = 0;
    } else {
        percentage = percentage - 10;
    }

    previewSize.value = percentage;

    displayImage(currentImageIndex);
}

async function zoomIn() {
    let percentage = parseInt(previewSize.value);
    if (percentage + 10 > 200) {
        percentage = 200;
    } else {
        percentage = percentage + 10;
    }

    previewSize.value = percentage;

    displayImage(currentImageIndex);
}

async function multiple() {
    loading.style.display = "";
    selectTranslationSelect.style.display = "none";
    let amount = [];
    cancel = false;

    for (let i = 0; i < layers.length; i++) {
        if (layers[i].state.check == "checked") {
            amount.push(layers[i]);
        }
    }

    let count = 0;
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type !== currentType) {
            currentType = layers[i].type;

            let menuList = document.getElementsByClassName('menu');

            for (let i = 0; i < menuList.length; i++) {
                if (menuList[i].getAttribute('key') === currentType) {
                    if (menuList[i].className === "menu") {
                        menuList[i].className = "menu selected";

                        await loadImageList();
                    }
                } else {
                    menuList[i].className = "menu";
                }
            }
        }

        if (layers[i].state.check == "checked") {

            await displayImage(layers[i].index);

            await processVisionData();

            await saveCanvas();

            if (cancel == true) {
                floatingToast(`번역이 중지되었습니다.`, 'failed');
                break;
            }

            floatingToast(`번역 중... (${count + 1}/${amount.length} 완료)`, 'inform');

            count += 1;
        }

    }

    startRegion.disabled = false;
    endRegion.disabled = false;

    loading.style.display = "none";

    if (cancel !== true) {
        floatingToast(`번역이 완료되었습니다.`, 'inform');
    }
}


async function single() {
    loading.style.display = "";

    await processVisionData();
    await saveCanvas();

    startRegion.disabled = false;
    endRegion.disabled = false;

    loading.style.display = "none";

    floatingToast(`번역이 완료되었습니다.`, 'inform');
}

async function thumbnail() {
    selectTranslationSelect.style.display = "none";
    thumbnailToggle.click();
    loading.style.display = "";
    cancel = false;

    let imgs = [];
    let newLayer = [];
    let imageList = document.getElementsByClassName('image-thumbnail');

    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type == "1") {
            newLayer.push(layers[i]);
        }
    }

    for (let i = 0; i < imageList.length; i++) {
        let checkBox = document.getElementById("check" + [i]);
        let img = document.getElementById("check" + [i]).getAttribute('key');

        if (checkBox.getAttribute('key') == img && checkBox.checked == true) {
            imgs.push(newLayer[i]);
        } else {
            checkBox.removeAttribute('checked');
        }
    }

    for (let i = 0; i < imgs.length; i++) {
        await displayImage(imgs[i].index);

        await processVisionData();

        await saveCanvas();

        if (cancel == true) {
            floatingToast(`번역이 중지되었습니다.`, 'failed');

            break;
        }

        floatingToast(`번역 중... (${i + 1}/${(imgs.length)} 완료)`, 'inform');
    }

    startRegion.disabled = false;
    endRegion.disabled = false;

    loading.style.display = "none";

    if (cancel !== true) {
        floatingToast(`번역이 완료되었습니다.`, 'inform');
    }

}

async function option() {
    selectTranslationSelect.style.display = "none";
    optionToggle.click();
    loading.style.display = "";
    cancel = false;


    let imgs = [];
    let newLayer = [];
    let imageList = document.getElementsByClassName('image-thumbnail');

    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type == "2") {
            newLayer.push(layers[i]);
        }
    }

    for (let i = 0; i < imageList.length; i++) {
        let checkBox = document.getElementById("check" + [i]);
        let img = document.getElementById("check" + [i]).getAttribute('key');

        if (checkBox.getAttribute('key') == img && checkBox.checked == true) {
            imgs.push(newLayer[i]);
        }
    }

    for (let i = 0; i < imgs.length; i++) {

        await displayImage(imgs[i].index);

        await processVisionData();

        await saveCanvas();

        if (cancel == true) {
            floatingToast(`번역이 중지되었습니다.`, 'failed');

            break;
        }

        floatingToast(`번역 중... (${i + 1}/${(imgs.length)} 완료)`, 'inform');
    }

    startRegion.disabled = false;
    endRegion.disabled = false;

    loading.style.display = "none";

    if (cancel !== true) {
        floatingToast(`번역이 완료되었습니다.`, 'inform');
    }
}

async function detail() {
    selectTranslationSelect.style.display = "none";
    detailToggle.click();
    loading.style.display = "";
    cancel = false;

    let imgs = [];
    let newLayer = [];
    let imageList = document.getElementsByClassName('image-thumbnail');

    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type == "3") {
            newLayer.push(layers[i]);
        }
    }

    for (let i = 0; i < imageList.length; i++) {
        let checkBox = document.getElementById("check" + [i]);
        let img = document.getElementById("check" + [i]).getAttribute('key');

        if (checkBox.getAttribute('key') == img && checkBox.checked == true) {
            imgs.push(newLayer[i]);
        }
    }

    for (let i = 0; i < imgs.length; i++) {

        await displayImage(imgs[i].index);

        await processVisionData();

        await saveCanvas();

        if (cancel == true) {
            floatingToast(`번역이 중지되었습니다.`, 'failed');

            break;
        }

        floatingToast(`번역 중... (${i + 1}/${(imgs.length)} 완료)`, 'inform');
    }

    startRegion.disabled = false;
    endRegion.disabled = false;

    loading.style.display = "none";

    if (cancel !== true) {
        floatingToast(`번역이 완료되었습니다.`, 'inform');
    }
}



function exit() {
    let accept = confirm("편집을 종료하고 초기화면으로 이동하시겠습니까?");

    if (!accept) {
        return;
    }

    window.location.href = "./app.html";
}

function recovery() {
    let accept = confirm("모든 이미지를 적용 전으로 되돌리시겠습니까?");
    let checked = document.getElementsByClassName(`checkBox`);


    if (accept) {
        for (let i = 0; i < layers.length; i++) {
            layers[i].image.current = layers[i].image.origin;
            layers[i].object = [];
            layers[i].state = {
                undo: {
                    canvas: [],
                    object: []
                },

                redo: {
                    canvas: [],
                    object: []
                },

                current: {},
                check: "checked",
            };
        }

        for(let i = 0; i < checked.length; i++ ){
            checked[i].checked = true;
        }
    }

    displayImage(currentImageIndex);
}

async function temp() {
    loading.style.display = "";

    let now = getClock();

    let projectResp = await fetch(`${FLASK_URL}upload?id=${appData.user.id}&time=${now.time}`, {
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify({ layers, isLocal, uploadImages, now }),

        method: "POST"
    });

    let proejctJson = await projectResp.json();
    let tempData = appData.temp ?? [];
    switch (proejctJson.code) {
        case "SUCCESS": {
            tempData.push({
                time: `${now.YY}-${now.MM}-${now.DD} ${now.hh}:${now.mm}:${now.ss}`,
                name: `${appData.user.id}-${now.time}`,
                data: proejctJson.data
            });

            appData = {
                ...appData,

                temp: tempData
            }

            localStorage.setItem('appInfo', JSON.stringify(appData));

            floatingToast(`임시저장이 완료되었습니다.`, 'success');

            break;
        }

        case "FAILED": {
            floatingToast(`임시저장에 실패하였습니다.`, 'failed');

            break;
        }

        default: break;
    }

    loading.style.display = "none";
}

/*----사용안함 코드확인용--------
function copy() {
    myCanvas.getActiveObject().clone(function(cloned){
        _clipboard = cloned;
    });
    console.log("_clipboard",_clipboard);
};

function paste() {
    _clipboard.clone(function(clonedObj) {
        myCanvas.discardActiveObject();
        console.log("clonedObj",clonedObj);
        clonedObj.set({
            left: clonedObj.left + 10,
            top: clonedObj.top + 10,
            evented: true,
        });
        if (clonedObj.type === 'activeSelection') {
            clonedObj.myCanvas = myCanvas;
            clonedObj.forEachObject(function(obj) {
                myCanvas.add(obj);
            });
            clonedObj.setCoords();
        } else {
            myCanvas.add(clonedObj);
        }
        _clipboard.top += 10;
        _clipboard.left += 10;
        myCanvas.setActiveObject(clonedObj);
        myCanvas.requestRenderAll();
    });
}
*/


function setKeyEvents() {
    window.addEventListener("wheel", async (e) => {
        if (e.shiftKey) {
            if (e.wheelDelta > 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }
    });

    window.addEventListener("keydown",  async (e) => {
        let objects = myCanvas.getActiveObject();
        let layer = getCurrentLayer();
        if (objects == null) {
            switch (e.key) {
                case (e.shiftKey && "!") : {
                    multiple();
                    break;
                }
    
                case (e.shiftKey && "@") : {
                    single();
                    break;
                }
    
                case (e.shiftKey && "#") : {
                    toggleToolbar(areaTranslation, 'area-translation');
                    break;
                }
    
                case (e.shiftKey && "$") : {
                    toggleToolbar(areaRemove, 'area-remove-drag');
                    break;
                }
    
                case (e.shiftKey && "%") : {
                    toggleToolbar(areaRecovery, 'area-recovery-drag');
                    break;
                }
            }
        }

        if(copyBox.length != 0){
            switch (e.key) {
                case (e.ctrlKey && "v") :
                case (e.ctrlKey && "V") : {
    
                    layer.object.push(copyBox[copyBox.length - 1]);
    
                    let copyXY =  layer.object[layer.object.length - 1];

                    copyXY.copyX = 20;
                    copyXY.copyY = 20;
    
                    delete copyBox[copyBox.length - 1].text;
                    delete copyBox[copyBox.length - 1].rect;

                    await displayImage(currentImageIndex);

                    copyBox = [];

                    break;
                }
            }
        }

        switch (e.key) {
            case ("Escape") : {
                cancel = true;
                break;
            }

            case (e.ctrlKey && "c") : 
            case (e.ctrlKey && "C") : {

                copyBox.push(JSON.parse(JSON.stringify(layer.object[objects.id])));

                break;
            }

            case (e.ctrlKey && "z") : 
            case (e.ctrlKey && "Z") : {
                replayCanvas("undo");
                break;
            }

            case (e.ctrlKey && "x") : 
            case (e.ctrlKey && "X") : {
                replayCanvas("redo");
                break;
            }

            case (e.shiftKey && "a") :
            case (e.shiftKey && "A") : {
                e.preventDefault();
                recovery();
                break;
            }

            case (e.shiftKey && "s") :
            case (e.shiftKey && "S") : {
                e.preventDefault();
                temp();
                break;
            }

            case (e.shiftKey && "d") :
            case (e.shiftKey && "D") : {
                e.preventDefault();
                exit();
                break;
            }

            case (e.shiftKey && "f") :
            case (e.shiftKey && "F") : {
                e.preventDefault();
                toggleToolbar(imageSave, "download");
                break;
            }

            case "F5": {
                let accept = confirm("편집을 종료하고 초기화면으로 이동하시겠습니까?");
                
                if (!accept) {
                    e.preventDefault();
                }

                break;
            }

            case "Delete": {
                let objects = myCanvas.getActiveObject();
                let layer = getCurrentLayer();

                if (objects) {
                    if (objects['_objects']) {
                        for (let i in objects['_objects']) {
                            let object = objects['_objects'][i];
                            let objectType = object.get('type');

                            switch (objectType) {
                                case "rect": {
                                    object.set({
                                        visible: false
                                    });

                                    layer.object[object.id] = {};
                                    floatingShapeTool.style.display = "none";

                                    break;
                                }

                                case "i-text": {
                                    object.set({
                                        visible: false
                                    });

                                    layer.object[object.id] = {};
                                    floatingTextTool.style.display = "none";

                                    break;
                                }

                                default: break;
                            }
                        }
                    } else {
                        let objectType = objects.get('type');

                        switch (objectType) {
                            case "rect": {
                                objects.set({
                                    visible: false
                                });
                                
                                layer.object[objects.id] = {};

                                break;
                            }

                            case "i-text": {
                                if (!objects.isEditing) {
                                    objects.set({
                                        visible: false
                                    });
                                    
                                    layer.object[objects.id] = {};

                                }
                                
                                break;
                            }

                            default: break;
                        }
                    }
                    
                    myCanvas.renderAll();
                }

                saveCanvas();
                
                break;
            }
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();

            let objects = myCanvas.getActiveObject();

            if (objects) {
                if (objects['_objects']) {
                    for (let i in objects['_objects']) {
                        let object = objects['_objects'][i];
                        let objectType = object.get('type');

                        switch (objectType) {
                            case "rect": {
                                object.set({
                                    top: object.top - 5,
                                });

                                break;
                            }

                            case "i-text": {
                                object.set({
                                    top: object.top - 5,
                                });

                                break;
                            }

                            default: break;
                        }

                    }
                } else {
                    let objectType = objects.get('type');

                    switch (objectType) {
                        case "rect": {
                            objects.set({
                                top: objects.top - 5,
                            });

                            break;
                        }

                        case "i-text": {
                            if (!objects.isEditing) {
                                objects.set({
                                    top: objects.top - 5,
                                });
                            }

                            break;
                        }

                        default: break;
                    }
                }

                myCanvas.renderAll();
            }

            saveCanvas();
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();

            let objects = myCanvas.getActiveObject();

            if (objects) {
                if (objects['_objects']) {
                    for (let i in objects['_objects']) {
                        let object = objects['_objects'][i];
                        let objectType = object.get('type');

                        switch (objectType) {
                            case "rect": {
                                object.set({
                                    top: object.top + 5,
                                });

                                break;
                            }

                            case "i-text": {
                                object.set({
                                    top: object.top + 5,
                                });

                                break;
                            }

                            default: break;
                        }

                    }
                } else {
                    let objectType = objects.get('type');

                    switch (objectType) {
                        case "rect": {
                            objects.set({
                                top: objects.top + 5,
                            });

                            break;
                        }

                        case "i-text": {
                            if (!objects.isEditing) {
                                objects.set({
                                    top: objects.top + 5,
                                });
                            }

                            break;
                        }

                        default: break;
                    }
                }

                myCanvas.renderAll();
            }

            saveCanvas();
        }

        if (e.key === "ArrowLeft") {
            e.preventDefault();

            let objects = myCanvas.getActiveObject();

            if (objects) {
                if (objects['_objects']) {
                    for (let i in objects['_objects']) {
                        let object = objects['_objects'][i];
                        let objectType = object.get('type');

                        switch (objectType) {
                            case "rect": {
                                object.set({
                                    left: object.left - 5,
                                });

                                break;
                            }

                            case "i-text": {
                                object.set({
                                    left: object.left - 5,
                                });

                                break;
                            }

                            default: break;
                        }

                    }
                } else {
                    let objectType = objects.get('type');

                    switch (objectType) {
                        case "rect": {
                            objects.set({
                                left: objects.left - 5,
                            });

                            break;
                        }

                        case "i-text": {
                            if (!objects.isEditing) {
                                objects.set({
                                    left: objects.left - 5,
                                });
                            }

                            break;
                        }

                        default: break;
                    }
                }

                myCanvas.renderAll();
            }

            saveCanvas();
        }

        if (e.key === "ArrowRight") {
            e.preventDefault();

            let objects = myCanvas.getActiveObject();

            if (objects) {
                if (objects['_objects']) {
                    for (let i in objects['_objects']) {
                        let object = objects['_objects'][i];
                        let objectType = object.get('type');

                        switch (objectType) {
                            case "rect": {
                                object.set({
                                    left: object.left + 5,
                                });

                                break;
                            }

                            case "i-text": {
                                object.set({
                                    left: object.left + 5,
                                });

                                break;
                            }

                            default: break;
                        }

                    }
                } else {
                    let objectType = objects.get('type');

                    switch (objectType) {
                        case "rect": {
                            objects.set({
                                left: objects.left + 5,
                            });

                            break;
                        }

                        case "i-text": {
                            if (!objects.isEditing) {
                                objects.set({
                                    left: objects.left + 5,
                                });
                            }

                            break;
                        }

                        default: break;
                    }
                }

                myCanvas.renderAll();
            }

            saveCanvas();
        }
    });
}

function setTypeEvents() {
    let menuList = document.getElementsByClassName('menu');

    for (let i = 0; i < menuList.length; i++) {
        menuList[i].addEventListener('click', async (e) => {
            if (currentType === e.target.getAttribute('key')) {
                return;
            }

            currentType = e.target.getAttribute('key');

            for (let j = 0; j < menuList.length; j++) {
                if (menuList[j].getAttribute('key') === currentType) {
                    if (menuList[j].className === "menu") {
                        menuList[j].className = "menu selected";

                        await loadImageList();
                    }
                } else {
                    menuList[j].className = "menu";
                }
            }
        });
    }
}

async function main() {
    let keyResp = await fetch(FLASK_URL + "getkey", {
        headers: {
            "Content-Type": "application/json",
        },

        method: "POST"
    });

    visionKey = await keyResp.text();

    loading.style.display = "";

    let appInfo = localStorage.getItem('appInfo');

    if (!appInfo) {
        window.location.href = `./login.html`;

        return;
    }

    appData = JSON.parse(appInfo);

    if (!appData || !appData.login) {
        window.location.href = `./login.html`;

        return;
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

    loadLocalSettings();

    pageUser.innerHTML = appData.user.id;

    if (appData.user.limit === '0') {
        pageLimit.parentNode.style.display = "none";

        pageType.className = "secondary";
        pageType.innerHTML = "요금제 만료";

        appData.user.available = false;
    } else {
        let time = new Date().getTime();
        let limited = new Date(`${appData.user.limit} 23:59:59`).getTime();

        if (time > limited) {
            let dday = Math.floor((time - limited) / (60 * 60 * 24 * 1000));

            pageLimit.parentNode.style.display = "";
            pageLimit.innerHTML = `
                <table style="width: 250px;">
                    <tr>
                        <td style="color: white; font-size: 14px; text-align: left;">
                            적립금
                        </td>

                        <td style="color: yellow; font-size: 14px; text-align: right;">
                            <span id="userCoupon">
                                ${appData.user.credit} 
                            </span> 원
                        </td>
                    </tr>

                    <tr>
                        <td style="color: white; font-size: 14px; text-align: left;">
                            만료날짜
                        </td>

                        <td style="font-size: 14px; text-align: right;">
                            <span style="color: yellow;">
                                ${appData.user.limit}
                            </span>
                            
                            <span style="color: beige;">
                                (D+${dday})
                            </span>
                        </td>
                    </tr>
                </table>
            `;

            pageType.className = "secondary";
            pageType.innerHTML = "요금제 만료";

            appData.user.available = false;
        } else {
            let dday = Math.floor((limited - time) / (60 * 60 * 24 * 1000));

            pageLimit.parentNode.style.display = "";
            pageLimit.innerHTML = `
                <table style="width: 250px;">
                    <tr>
                        <td style="color: white; font-size: 14px; text-align: left;">
                            적립금
                        </td>

                        <td style="color: yellow; font-size: 14px; text-align: right;">
                            <span id="userCoupon">
                                ${appData.user.credit} 
                            </span> 원
                        </td>
                    </tr>

                    <tr>
                        <td style="color: white; font-size: 14px; text-align: left;">
                            남은 이미지 수
                        </td>

                        <td style="color: yellow; font-size: 14px; text-align: right;">
                            <span id="userCredit">
                                ${appData.user.usage} 
                            </span>
                        </td>
                    </tr>

                    <tr>
                        <td style="color: white; font-size: 14px; text-align: left;">
                            만료날짜
                        </td>

                        <td style="font-size: 14px; text-align: right;">
                            <span style="color: yellow;">
                                ${appData.user.limit}
                            </span>
                            
                            <span style="color: beige;">
                                (D-${dday})
                            </span>
                        </td>
                    </tr>
                </table>
            `;

            pageType.className = "primary";

            switch (appData.user.rank) {
                case "basic": {
                    pageType.innerHTML = "체험판";
                    userCredit.innerHTML = appData.user.usage;

                    break;
                }

                default: {
                    pageType.innerHTML = "정식판";
                    userCredit.innerHTML = "무제한";

                    break;
                }
            }
        }
    }

    canvasSetting();

    imageToolHelper();

    setKeyEvents();
    setTypeEvents();

    uploadFromPC.addEventListener('change', async (e) => {
        if (!appData.user.available) {
            floatingToast(`결제 후 이용해주세요.`, 'failed');

            return;
        }

        loading.style.display = "";

        isLocal = true;

        textFromPC.innerHTML = `
            이미지 업로드 중...

            <br />
            
            <span style="color: lightgray; font-size: 16px;">
                잠시만 기다려주세요...
            </span>
        `;

        const files = e.target.files;

        uploadImages = [];

        for (let i in files) {
            try {
                const result = await readFileAsync(files[i]);

                uploadImages.push(result);
            } catch (e) {
                continue;
            }
        }

        await addToLayers();

        currentType = "0";

        await loadImageList();

        loading.style.display = "none";

        headerFromPC.style.display = "";
        menuToolbar.style.display = "";
    });

    uploadFromURL.addEventListener('click', async (e) => {

        if (!appData.user.available) {
            floatingToast(`결제 후 이용해주세요.`, 'failed');

            return;
        }

        let tabUrl = window.prompt('쇼핑몰 링크를 입력해주세요.', '');

        if (!tabUrl) {
            return;
        }

        if (!/^https?/.test(tabUrl)) {
            floatingToast("주소 형식이 올바르지 않습니다.", 'failed');

            return;
        }

        let isValid = false;

        for (let i in urlList) {
            if (tabUrl.includes(urlList[i])) {
                isValid = true;

                break;
            }
        }

        if (!isValid) {
            floatingToast("지원하지 않는 쇼핑몰입니다.", 'failed');

            return;
        }

        loading.style.display = "";

        if (tabUrl) {
            textFromURL.innerHTML = `
                쇼핑몰 접속 중...

                <br />
                
                <span style="color: lightgray; font-size: 16px;">
                    잠시만 기다려주세요...
                </span>
            `;

            let tabId = null;
            let tabTimeout = 0;

            chrome.tabs.create({ active: false, url: tabUrl }, async function (tab) {
                tabId = tab.id;
            });

            let loaded = false;

            while (true) {
                if (tabTimeout === 30) {
                    floatingToast("쇼핑몰 접속 상태 확인 후 재시도 바랍니다.", "failed");

                    loading.style.display = "none";

                    return true;
                }

                if (tabId) {
                    chrome.tabs.query({}, function (tabs) {
                        for (let i in tabs) {
                            if (tabs[i].id === tabId && tabs[i].status === 'complete') {
                                loaded = true;

                                break;
                            }
                        }
                    });

                    if (loaded) {
                        break;
                    }
                }

                tabTimeout++;

                await sleep(1000 * 1);
            }

            textFromURL.innerHTML = `
                쇼핑몰 이미지 추출 중...

                <br />
                
                <span style="color: lightgray; font-size: 16px;">
                    잠시만 기다려주세요.
                </span>
            `;

            chrome.tabs.sendMessage(tabId, { action: "scrape" }, async(response) => {

                isLocal = false;

                uploadImages = response;

                if (uploadImages.code === 'ERROR') {
                    floatingToast(uploadImages.message, 'failed');

                    return;
                }

                await addToLayers();

                currentType = "1";

                await loadImageList();

                loading.style.display = "none";

                headerFromURL.style.display = "";
                menuToolbar.style.display = "";

                chrome.tabs.remove(tabId);
            });
        }
    });

    uploadFromProject.addEventListener('change', async (e) => {
        if (!appData.user.available) {
            floatingToast(`결제 후 이용해주세요.`, 'failed');

            return;
        }

        loading.style.display = "";

        textFromProject.innerHTML = `
            프로젝트 불러오는 중...
        `;

        const files = e.target.files;

        let projectText = await files[0].text();
        let projectJson = JSON.parse(projectText);

        await loadProject(projectJson);

        loading.style.display = "none";
    });

    uploadFromRecent.innerHTML += `
        <div style="color: white; font-size: 24px; font-weight: bold; margin: 30px 0px 30px 0px;">
            최근에 작업한 내용
        </div>

        <div class="default" style="height: 300px; overflow-y: auto;">
            <table id="recentProjects">
            </table>
        </div>
    `;

    if (appData.temp) {
        let sorted = sortBy(appData.temp, "time", false);

        sorted.map((v, i) => {
            recentProjects.innerHTML += `
                <tr>
                    <td class="dark" style="padding: 10px; width: 60%;">
                        <button class="recents button inform round" key="${i}" style="font-size: 12px; font-weight: bold; padding: 10px; width: 100%;">
                            ${v.name}
                        </button>
                    </td>
    
                    <td class="dark" style="color: lightgray; font-size: 12px; font-weight: bold; text-align: center; padding: 10px; width: 40%;">
                        ${v.time}
                    </td>
                </tr>
            `;
        });

        let recents = document.getElementsByClassName('recents');

        for (let i = 0; i < recents.length; i++) {
            recents[i].addEventListener('click', async () => {
                let key = recents[i].getAttribute('key');

                if (!appData.temp[key]) {
                    return;
                }

                loading.style.display = "";

                let projectResp = await fetch(`${FLASK_URL}${appData.temp[key].data}`);
                let projectJson = await projectResp.json();

                await loadProject(projectJson);
                loading.style.display = "none";
            });
        }
    }

    pagePayment.addEventListener('click', () => {
        window.open("./payment.html");
    });

    pageUserGuide.addEventListener('click', () => {
        window.open("https://panoramic-butternut-291.notion.site/158cda956e764f129b1028cf0329c8f1");
    })

    pageLogOut.addEventListener('click', onLogout)

    loading.style.display = "none";

    //24시간 후 자동 로그아웃
    await sleep(1000 * 60 * 60 * 24);

    onLogout();
}

main();