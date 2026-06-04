/**
 * Placeholder widgets shown before host sends rendered content.
 */

import { WidgetType } from '@codemirror/view';

export class MathPlaceholderWidget extends WidgetType {
    constructor(readonly content: string, readonly prefix: string) {
        super();
    }

    eq(other: MathPlaceholderWidget): boolean {
        return this.content === other.content && this.prefix === other.prefix;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-placeholder-widget';
        wrap.textContent = `${this.prefix}{ ${this.content} }`;
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

export class ImagePlaceholderWidget extends WidgetType {
    constructor(readonly path: string) {
        super();
    }

    eq(other: ImagePlaceholderWidget): boolean {
        return this.path === other.path;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-placeholder-widget';
        wrap.textContent = `[Loading: ${this.path}]`;
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

export class ImageErrorWidget extends WidgetType {
    constructor(readonly path: string, readonly message: string) {
        super();
    }

    eq(other: ImageErrorWidget): boolean {
        return this.path === other.path;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-image-error';
        wrap.textContent = `[${this.message}]`;
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}
