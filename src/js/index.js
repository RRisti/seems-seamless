import { gridElement, enableGridTransition } from './grid.js';
import { getNextGridLayout } from './layout.js';
import { setLabelText, revertLabelText } from './label.js';
import { closestStepIncrement, closestStepDecrement, formatNumber } from './math.js';
import {
    CSS_BACKGROUND_REPEAT,
    CSS_BACKGROUND_WIDTH ,
    CSS_TRANSITION_DURATION ,
    CSS_ZOOM_LEVEL,
    EVENT_DRAG_OVER ,
    EVENT_DRAG_ENTER,
    EVENT_DRAG_LEAVE,
    EVENT_DROP,
    SELECTOR_CELL_ELEMENT,
    // Misc
    INITIAL_SCALE,
    BACKGROUND_MINIMUM,
    BACKGROUND_MAXIMUM,
    ZOOM_STEP,
} from './const.js';

// "State"
let hasImage = false;
let backgroundSize = 100;
let blobCache = null;
let currentSource;

const documentElement = selector => document.querySelector(selector);
const documentEvent = (eventName, callback) => document.addEventListener(eventName, callback);

const bodyElement = documentElement('body');
const setCssVariable = (property, value) => bodyElement.style.setProperty(property, value);

const imageElement = new Image();
let imageWidth = 0;
let imageHeight = 0;

const preventDefault = (event) => {
    event.stopPropagation();
    event.preventDefault();
};

// Canvas
const canvasElement = document.createElement('canvas');
const canvasContext = canvasElement.getContext('2d');
const setDimensions = ({ height, width }) => {
    imageHeight = height;
    imageWidth = width;
    Object.assign(canvasElement, { width, height });

    setCssVariable(CSS_BACKGROUND_WIDTH, `${width}px`);
};

const parser = new DOMParser();

// Input
const fileInputElement = documentElement('input[type="file"]');
const backgroundRepeatCheckboxElement = documentElement('#repeatInput');
const zoomInputElement = documentElement('#zoomInput');

const cellElements = [...document.querySelectorAll(SELECTOR_CELL_ELEMENT)];

const toggleActiveCells = (element = null) => {
    const DATA_ACTIVE = 'data-active';
    const ACTIVE_CLASS_NAME = '__active';

    gridElement.removeAttribute(DATA_ACTIVE);




    if (element) {
        if (element.classList.includes(ACTIVE_CLASS_NAME)) {
          return element.classList.remove(ACTIVE_CLASS_NAME);
        }

        const activeIndex = [...element.parentElement.children].indexOf(element);
        gridElement.setAttribute(DATA_ACTIVE, `${activeIndex + 1}`);
    }

    cellElements.forEach((cellElement) => {
        cellElement.classList.toggle(ACTIVE_CLASS_NAME, cellElement === element);
    });
};

const toggleActiveCellsByIndex = (index) => {
    const cellElement = cellElements[index];

    if (cellElement) toggleActiveCells(cellElement);
};
const setBackgroundSizeLabelText = () => {
    const scale = formatNumber(backgroundSize / 100);
    const scaleDimension = (value) => Math.floor(scale * value);

    setLabelText(`${backgroundSize.toFixed(2)}% | ${scaleDimension(imageWidth)} x ${scaleDimension(imageHeight)}`);
};
const setBackgroundSize = (value) => {
    backgroundSize = Math.min(BACKGROUND_MAXIMUM, Math.max(BACKGROUND_MINIMUM, +value));
    zoomInputElement.value = `${value}`;
    setCssVariable(CSS_ZOOM_LEVEL, `${formatNumber(backgroundSize / 100)}`);
    setBackgroundSizeLabelText();
};

const draw = ({ row, column }, index) => {
    canvasContext.drawImage(
        imageElement,
        column * imageWidth,
        row * imageHeight,
        imageWidth,
        imageHeight,
        0,
        0,
        imageWidth,
        imageHeight,
    );

    canvasElement.toBlob((blob) => {
        cellElements[index].style.backgroundImage = `url(${URL.createObjectURL(blob)})`; // @todo: Clean cache
    });
};
const renderImages = () => {
    setDimensions({
        height: imageElement.naturalHeight / 2,
        width:imageElement.naturalWidth / 2,
    });

  [[0,0],[0,1],[1,0],[1,1]]
      .map(([row, column]) => ({ row, column }))
      .forEach(draw);

    hasImage = true;
    zoomInputElement.disabled = false;
    setBackgroundSize(INITIAL_SCALE * 50 * Math.min(window.innerWidth / imageWidth, window.innerHeight / imageHeight));
};

const formatImageSource = (source) => {
    if (!source) return;

    try {
        const url = new URL(source);
        const { host, searchParams } = url;

        if (['cdn.discordapp.com','media.discordapp.net'].includes(host)) {
            searchParams.delete('width');
            searchParams.delete('height');
        }

        return `${url}`;
    } catch (error) {
        console.error(error);
    }
}
const setLoadProgressLabel = (progress = 0) => setLabelText(`Loading image ${progress.toFixed(0)}%...`);
const loadImageWithProgressFromURL = (url) => {
    const source = formatImageSource(url);

    if (!source || source === currentSource) return;

    currentSource = source;

    const request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.open('GET', source, true);

    request.addEventListener('loadstart', () => setLoadProgressLabel());
    request.addEventListener('progress', ({ loaded, total }) => setLoadProgressLabel((loaded / total) * 100));
    request.addEventListener('error', () => setLabelText(`Error loading image`));

    request.addEventListener('load', (event) => {
        const blob = new Blob([event.target.response]);

        if (blobCache) {
            window.URL.revokeObjectURL(blobCache);
            blobCache = blob;
        }
        imageElement.addEventListener('load', renderImages, {
            once: true,
        });
        imageElement.src = window.URL.createObjectURL(blob);

        toggleActiveCells();
    });

    request.send();

    return request;
};
const extractImageSource = (html) => {
    if (!html) return;

    const DOM = parser.parseFromString(html, 'text/html');

    for (let [selector, attribute = 'href'] of [
        ['img', 'src'],
        ['a[href$=".png"]', 'href'],
        ['a[href$=".jpg"]', 'href'],
        ['a[href$=".jpeg"]', 'href'],
        ['a[href$=".webp"]', 'href'],
    ]) {
        const source = DOM.querySelector(selector)?.getAttribute(attribute);

        if (source) return source;
    }
};
const loadImageFromHTML = (html) => loadImageWithProgressFromURL(extractImageSource(html));

const loadImageFromText = (text) => {
    const source = text?.split(/\s+/).find((part) => /^https?:\/\//.test(part) && /\.(jpe?g|png|webp)$/.test(part));

    if (source) return loadImageWithProgressFromURL(source);
};

const handleFile = () => {

}

const handleData = (dataTransfer) => {
    // Load from dropped file
    const file = [...dataTransfer.files].find(({ type }) => type.startsWith('image/'));

    if (file) {
        currentSource = null;
        let reader = new FileReader();
        reader.readAsDataURL(file);

        reader.addEventListener('loadend', () => {
            imageElement.addEventListener('load', renderImages, { once: true });
            imageElement.src = `${reader.result}`;

            toggleActiveCells();
        });
    }

    // Load from dropped HTML
    const html = dataTransfer.getData?.('text/html');
    if (html) return loadImageFromHTML(html);

    // Load from dropped text
    const text = dataTransfer.getData?.('text');
    if (text) return loadImageFromText(text);
};

// Mouse scroll
documentEvent('wheel', (event) => {
    if (hasImage) {
       setBackgroundSize(formatNumber(backgroundSize - event.deltaY / 20));
    }
});

// Change zoom: Range input
zoomInputElement.addEventListener('input', ({ target }) => setBackgroundSize(target.value));

// Drag & Drop
[EVENT_DRAG_OVER, EVENT_DRAG_ENTER, EVENT_DRAG_LEAVE, EVENT_DROP].forEach((name) => {
    bodyElement.addEventListener(name, (event) => {
        preventDefault(event);

        if (name === EVENT_DRAG_ENTER) setLabelText('Load');
        if (name === EVENT_DRAG_LEAVE) revertLabelText();
        if (name === EVENT_DROP) {
            handleData(event.dataTransfer);
            setBackgroundSizeLabelText();

            return false;
        }
    });
});

// Keyboard events
documentEvent('keyup', ({ code }) => {
    if (!hasImage) return;

    if (code === 'ArrowUp' || code === 'ArrowDown') {
        enableGridTransition();
        const fn = code === 'ArrowUp' ? closestStepIncrement : closestStepDecrement;
        setBackgroundSize(fn(backgroundSize, ZOOM_STEP));
        return;
    }

    if (code === 'Space') {
        setCssVariable(CSS_TRANSITION_DURATION, '0ms');
        bodyElement.dataset.columns = `${getNextGridLayout()}`;
        setTimeout(() => setCssVariable(CSS_TRANSITION_DURATION, null), 10);
        return;
    }

    toggleActiveCellsByIndex(['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code));
});

documentEvent('click', ({ target }) => {
    if (hasImage && target.matches(SELECTOR_CELL_ELEMENT)) {
        toggleActiveCells(target);
    }
});

documentEvent('paste', (event) => handleData(event.clipboardData));

// Load file from input
fileInputElement.addEventListener('change', (event) => {
    preventDefault(event);
    handleData(event.target);
});

// Toggle background repeat;
backgroundRepeatCheckboxElement.addEventListener('change', (event) => {
    setCssVariable(CSS_BACKGROUND_REPEAT, !event.target.checked ? 'repeat' : 'no-repeat');
});
