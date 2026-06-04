/**
 * CodeMirror 6 widget for rendered images.
 * Replaces img{} blocks with inline images whose intrinsic aspect ratio drives
 * the rendered height, allowing the containing editor line to grow naturally.
 */

import { WidgetType } from '@codemirror/view';

export class ImageWidget extends WidgetType {
    constructor(
        readonly uri: string,
        readonly path: string,
    ) {
        super();
    }

    eq(other: ImageWidget): boolean {
        return this.uri === other.uri;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-image-widget';
        wrap.setAttribute('aria-label', `Embedded image: ${this.path}`);

        const img = document.createElement('img');
        img.src = this.uri;
        img.alt = this.path;
        img.style.display = 'block';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.maxWidth = 'min(24em, 100%)';
        img.style.maxHeight = 'none';
        img.style.objectFit = 'contain';
        img.draggable = false;

        img.onerror = () => {
            wrap.textContent = `[Image not found: ${this.path}]`;
            wrap.classList.add('cm-image-error');
        };

        wrap.appendChild(img);
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}
