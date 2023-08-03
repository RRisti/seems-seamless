(() => {
    class Grid {
        constructor() {
            this.element = document.querySelector('.grid');
            this.transtioningClassName = '__transitioning';

            this.element.addEventListener('transitionend', (event) => {
                if (event.propertyName === 'background-size') {
                    this.element.classList.remove(this.transtioningClassName);
                }
            });
        }

        enableTransition() {
            this.element.classList.add(this.transtioningClassName);
        }
    }

    class Storage {
        getData() {
            return JSON.parse(localStorage.getItem('config')) || {};
        }

        setData(data) {
            localStorage.setItem(
                'config',
                JSON.stringify({
                    ...this.getData(),
                    ...data,
                }),
            );
        }
    }

    class Viewer {
        constructor() {
            this.storage = new Storage();
            this.imageElement = new Image();
            this.width = 0;
            this.height = 0;
            this.backgroundSize = 100;
            this.initalZoom = 0.9;
            this.zoomStep = 20;

            this.layout = this.layoutGenerator();
            this.bodyElement = document.querySelector('body');
            this.canvasElement = document.createElement('canvas');

            this.canvasRenderingContext = this.canvasElement.getContext('2d');
            this.cellElements = [...document.querySelectorAll('.cell')];
            this.informationTextElement = document.querySelector('.informationText');
            this.zoomInputElement = document.querySelector('#zoomInput');
            this.previousLabelText = '';
            this.parser = new DOMParser();
            this.grid = new Grid();
            this.hasImage = false;
            this.blobCache = null;

            let source = null;
            Object.defineProperty(this, 'currentSource', {
                get: () => source,
                set: (currentSource) => {
                    source = currentSource;
                    this.storage.setData({ currentSource });
                },
            });

            this.addEventListeners();
            this.load();
        }

        load() {
            const config = this.storage.getData();

            if (config.currentSource) {
                this.loadImageWithProgress(config.currentSource);
            }

            if (config.backgroundSize) {
                this.setBackgroundSize(config.backgroundSize);
            }
        }

        *layoutGenerator() {
            while (true) yield* [4, 1, 2];
        }
        getNextGridLayout() {
            return this.layout.next().value;
        }

        setImageDimensions({ height, width }) {
            this.height = height;
            this.width = width;
            this.setCssVariable('--background-width', `${width}px`);

            return this;
        }

        setCssVariable(property, value) {
            this.bodyElement.style.setProperty(property, value);
        }

        setLabelText(text) {
            if (this.previousLabelText !== this.informationTextElement.textContent) {
                this.previousLabelText = this.informationTextElement.textContent;
            }
            this.informationTextElement.textContent = `${text}`;
        }

        revertLabelText() {
            this.setLabelText(this.previousLabelText);
        }

        resizeCanvas() {
            this.canvasElement.width = this.width;
            this.canvasElement.height = this.height;

            return this;
        }

        draw({ column, row }) {
            this.canvasRenderingContext.drawImage(
                this.imageElement,
                column * this.width,
                row * this.height,
                this.width,
                this.height,
                0,
                0,
                this.width,
                this.height,
            );

            return this;
        }
        // Main draw
        renderImages() {
            const width = this.imageElement.naturalWidth / 2;
            const height = this.imageElement.naturalHeight / 2;
            this.setImageDimensions({ height, width }).resizeCanvas();
            [
                [0, 0],
                [0, 1],
                [1, 0],
                [1, 1],
            ].forEach(([row, column], index) => {
                this.draw({ column, row });

                this.canvasElement.toBlob((blob) => {
                    const cellElement = this.cellElements[index];
                    const url = URL.createObjectURL(blob); // @todo: Clean cache
                    cellElement.style.backgroundImage = `url(${url})`;
                });
            });

            const cellWidth = Math.max(...this.cellElements.map((_) => _.clientWidth));
            const cellHeight = Math.max(...this.cellElements.map((_) => _.clientHeight));

            this.setBackgroundSize(this.initalZoom * Math.min(100 * (cellWidth / width), 100 * (cellHeight / height)));

            this.hasImage = true;
            this.zoomInputElement.disabled = false;
        }
        extractImageSource(html) {
            const DOM = this.parser.parseFromString(html, 'text/html');

            for (let [selector, attribute] of [
                ['img', 'src'],
                ['a[href$=".png"]', 'href'],
                ['a[href$=".jpg"]', 'href'],
                ['a[href$=".jpeg"]', 'href'],
                ['a[href$=".svg"]', 'href'],
                ['a[href$=".webp"]', 'href'],
            ]) {
                const src = DOM.querySelector(selector)?.getAttribute(attribute);
                if (src) return src;
            }
        }

        setBackgroundSizeLabelText() {
            const zoom = +(this.backgroundSize / 100).toFixed(2);
            const zoomText = `${this.backgroundSize.toFixed(2)}%`;
            const dimensionsTexts = [this.width, this.height].map((_) => Math.floor(zoom * _)).join(' x ');

            this.setLabelText(`${zoomText} | ${dimensionsTexts}`);
        }
        setBackgroundSize(backgroundSize) {
            this.backgroundSize = Math.min(250, Math.max(10, backgroundSize));
            this.storage.setData({ backgroundSize: this.backgroundSize });

            this.zoomInputElement.value = `${backgroundSize}`;
            const zoom = +(this.backgroundSize / 100).toFixed(2);
            this.setCssVariable('--zoom-level', `${zoom}`);
            this.setBackgroundSizeLabelText();

            return this;
        }

        loadImageWithProgress(url) {
            const source = url.startsWith('https://cdn.discordapp.com/') ? url.split('?').shift() : url;

            if (this.currentSource === source) return;

            this.currentSource = source;

            const request = new XMLHttpRequest();
            request.open('GET', source, true);
            request.responseType = 'arraybuffer';

            /** @param {number|string} progress */
            const loading = (progress = 0) => this.setLabelText(`Loading image ${progress}%...`);

            request.addEventListener('loadstart', () => loading(0));

            request.addEventListener('progress', ({ loaded, total }) => loading(((loaded / total) * 100).toFixed(0)));

            request.addEventListener('error', () => this.setLabelText(`Error loading image`));

            request.addEventListener('load', (e) => {
                const blob = new Blob([e.target.response]);
                if (this.blobCache) {
                    window.URL.revokeObjectURL(this.blobCache);
                    this.blobCache = blob;
                }
                this.imageElement.addEventListener('load', () => this.renderImages(), {
                    once: true,
                });
                this.imageElement.src = window.URL.createObjectURL(blob);

                this.toggleCells();
            });

            request.send();

            return request;
        }

        loadImageFromHTML(html) {
            const source = html && this.extractImageSource(html);
            if (source) return this.loadImageWithProgress(source);
        }

        loadImageFromText(text) {
            const source = text
                ?.split(/\s+/)
                .find((part) => /^https?:\/\//.test(part) && /\.(jpe?g|png|svg|webp)$/.test(part));

            if (source) return this.loadImageWithProgress(source);
        }

        toggleCells(element = null) {
            this.grid.element.removeAttribute('data-active');

            if (element?.matches('.__active')) {
                element.classList.remove('__active');
                return;
            }

            if (element) {
                const activeIndex = [...element.parentElement.children].indexOf(element);
                this.grid.element.setAttribute('data-active', `${activeIndex + 1}`);
            }

            this.cellElements.forEach((cellElement) => {
                cellElement.classList.toggle('__active', cellElement === element);
            });
        }

        toggleCellsByIndex(index) {
            this.toggleCells(this.cellElements[index]);
        }

        addEventListeners() {
            const handleData = (dataTransfer) => {
                // Load from dropped file
                const file = [...dataTransfer.files].find((file) => file.type.startsWith('image/'));

                if (file) {
                    this.currentSource = null;
                    let reader = new FileReader();
                    reader.readAsDataURL(file);

                    reader.addEventListener('loadend', () => {
                        this.imageElement.addEventListener('load', () => this.renderImages(), { once: true });
                        this.imageElement.src = `${reader.result}`;

                        this.toggleCells();
                    });
                    return;
                }

                if (!dataTransfer.getData) return;

                // Load from dropped HTML
                const html = dataTransfer.getData('text/html');
                if (html) return this.loadImageFromHTML(html);

                // Load from dropped text
                const text = dataTransfer.getData('text');
                if (text) return this.loadImageFromText(text);
            };

            const noop = (event) => {
                event.stopPropagation();
                event.preventDefault();
            };

            this.bodyElement.addEventListener('dragenter', (event) => {
                noop(event);
                this.setLabelText('Load');
            });

            this.bodyElement.addEventListener('dragover', noop);
            this.bodyElement.addEventListener('dragleave', (event) => {
                noop(event);
                this.revertLabelText();
            });

            this.bodyElement.addEventListener('drop', (event) => {
                noop(event);
                handleData(event.dataTransfer);
                this.setBackgroundSizeLabelText();

                return false;
            });

            // Mouse scroll
            document.addEventListener('wheel', (event) => {
                if (!this.hasImage) return;

                const size = +(this.backgroundSize - event.deltaY / 20).toFixed(2);
                this.setBackgroundSize(size);
            });

            this.zoomInputElement.addEventListener('input', ({ target }) => {
                this.setBackgroundSize(+target.value);
            });

            document.addEventListener('keyup', (event) => {
                if (!this.hasImage) return;

                switch (event.code) {
                    case 'Digit1': {
                        return this.toggleCellsByIndex(0);
                    }
                    case 'Digit2': {
                        return this.toggleCellsByIndex(1);
                    }
                    case 'Digit3': {
                        return this.toggleCellsByIndex(2);
                    }
                    case 'Digit4': {
                        return this.toggleCellsByIndex(3);
                    }

                    case 'ArrowDown':
                    case 'ArrowUp': {
                        this.grid.enableTransition();
                        const isZoomingIn = event.code === 'ArrowUp';
                        const { backgroundSize, zoomStep } = this;

                        const size = isZoomingIn
                            ? Math.floor(backgroundSize / zoomStep + 1) * zoomStep
                            : Math.ceil(backgroundSize / zoomStep - 1) * zoomStep;

                        this.setBackgroundSize(size);
                        break;
                    }

                    case 'Space': {
                        this.setCssVariable('--transition-duration', '0ms');
                        this.bodyElement.dataset.columns = `${this.getNextGridLayout()}`;
                        setTimeout(() => this.setCssVariable('--transition-duration', null), 10);

                        break;
                    }
                    default: {
                        return;
                    }
                }
            });

            document.addEventListener('click', ({ target }) => {
                if (!this.hasImage) return;
                if (target.matches('.cell')) this.toggleCells(target);
            });

            // Paste image url
            document.addEventListener('paste', (event) => handleData(event.clipboardData));

            // File input
            document.querySelector('input[type="file"]').addEventListener('change', (event) => {
                noop(event);
                handleData(event.target);
            });

            // Toggle background repeat;
            document.querySelector('#repeatInput').addEventListener('change', (event) => {
                this.setCssVariable('--background-repeat', !event.target.checked ? 'repeat' : 'no-repeat');
            });
        }
    }

    new Viewer();
})();
