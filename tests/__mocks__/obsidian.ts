/** Runtime stub for the type-only `obsidian` package in tests.
 *  Provides enough real DOM behavior for behavioral tests. */

class FakeElement {
  _tag: string;
  _cls = '';
  _text = '';
  _children: FakeElement[] = [];
  _listeners: Record<string, Array<(e: any) => void>> = {};
  value = '';
  checked = false;
  placeholder = '';
  attr: Record<string, string> = {};
  textContent = '';

  constructor(tag = 'div') {
    this._tag = tag;
  }

  addClass(c: string) { this._cls = this._cls ? `${this._cls} ${c}` : c; }
  setText(t: string) { this._text = t; this.textContent = t; }
  setAttribute(k: string, v: string) { this.attr[k] = v; }
  focus() {}
  addEventListener(type: string, fn: (e: any) => void) {
    (this._listeners[type] ??= []).push(fn);
  }
  createEl(tag: string, opts?: any): FakeElement {
    const el = new FakeElement(tag);
    if (typeof opts === 'string') el._cls = opts;
    else if (opts) {
      if (opts.text) el._text = opts.text;
      if (opts.cls) el._cls = opts.cls;
      if (opts.attr) el.attr = opts.attr;
      if (opts.type) el.attr.type = opts.type;
      if (opts.placeholder) el.placeholder = opts.placeholder;
    }
    this._children.push(el);
    return el;
  }
  createDiv(opts?: any): FakeElement {
    return this.createEl('div', opts);
  }
  empty() { this._children = []; }
  find(tag: string): FakeElement | undefined {
    for (const c of this._children) {
      if (c._tag === tag) return c;
      const found = c.find(tag);
      if (found) return found;
    }
    return undefined;
  }
  findAll(cls: string): FakeElement[] {
    const result: FakeElement[] = [];
    for (const c of this._children) {
      if (c._cls.includes(cls)) result.push(c);
      result.push(...c.findAll(cls));
    }
    return result;
  }
  findSelect(): FakeElement | undefined {
    for (const c of this._children) {
      if (c._tag === 'select') return c;
      const found = c.findSelect();
      if (found) return found;
    }
    return undefined;
  }
  findInput(): FakeElement | undefined {
    for (const c of this._children) {
      if (c._tag === 'input' || c._tag === 'textarea') return c;
      const found = c.findInput();
      if (found) return found;
    }
    return undefined;
  }
  triggerChange(value: string) {
    const handler = this._listeners['change']?.[0];
    if (handler) handler({ target: { value } });
  }
  triggerClick() {
    const handler = this._listeners['click']?.[0];
    if (handler) handler({});
  }
}

export class Modal {
  modalEl = new FakeElement();
  titleEl = new FakeElement();
  contentEl = new FakeElement();
  scope = { register(_modifiers: any, _key: string, _fn: any) {} };
  onClose: (() => void) | null = null;
  open(): void {}
  close(): void { this.onClose?.(); }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = new FakeElement();
  }
  display(): void {}
}

export class Setting {
  _nameEl: FakeElement;
  _descEl: FakeElement;
  _containerEl: FakeElement;
  _dropdown: FakeElement | null = null;
  _textEl: FakeElement | null = null;
  _sliderEl: FakeElement | null = null;
  _toggleEl: FakeElement | null = null;
  _onChangeCallbacks: Array<(v: string) => void> = [];

  constructor(containerEl: any) {
    this._containerEl = containerEl;
    this._nameEl = new FakeElement('div');
    this._descEl = new FakeElement('div');
  }
  setName(name: string) { this._nameEl._text = name; return this; }
  setDesc(desc: string) { this._descEl._text = desc; return this; }
  addDropdown(drop: any) {
    this._dropdown = new FakeElement('select');
    this._containerEl._children.push(this._dropdown);
    const builder = {
      addOptions: (opts: Record<string, string>) => {
        for (const [val, label] of Object.entries(opts)) {
          const opt = this._dropdown!.createEl('option', { text: label });
          opt.value = val;
        }
        return builder;
      },
      setValue: (v: string) => { this._dropdown!.value = v; return builder; },
      onChange: (fn: (v: string) => void) => {
        this._onChangeCallbacks.push(fn);
        // Wire element change event to the callback
        this._dropdown!.addEventListener('change', (e: any) => fn(e.target.value));
        return builder;
      },
    };
    drop(builder);
    return this;
  }
  addText(text: any) {
    this._textEl = new FakeElement('input');
    const builder = {
      setPlaceholder: (p: string) => { this._textEl!.placeholder = p; return builder; },
      setValue: (v: string) => { this._textEl!.value = v; return builder; },
      onChange: (fn: (v: string) => void) => { this._onChangeCallbacks.push(fn); return builder; },
    };
    text(builder);
    return this;
  }
  addSlider(slider: any) {
    this._sliderEl = new FakeElement('input');
    const builder = {
      setLimits: (_a: number, _b: number, _c: number) => builder,
      setValue: (v: number) => { this._sliderEl!.value = String(v); return builder; },
      setDynamicTooltip: () => builder,
      onChange: (fn: (v: number) => void) => { this._onChangeCallbacks.push(fn); return builder; },
    };
    slider(builder);
    return this;
  }
  addToggle(toggle: any) {
    this._toggleEl = new FakeElement('input');
    const builder = {
      setValue: (v: boolean) => { this._toggleEl!.checked = v; return builder; },
      onChange: (fn: (v: boolean) => void) => { this._onChangeCallbacks.push(fn); return builder; },
    };
    toggle(builder);
    return this;
  }
}

export class Notice {
  constructor(_msg: string, _timeout?: number) {}
}

export class Component {
  load() {}
  unload() {}
}

export function createEl(_tag: string, _opts?: any): any { return {}; }

export const Platform = {
  isMobile: false,
  isDesktop: true,
  isDesktopApp: true,
  isMobileApp: false,
  isWin: false,
  isMacOS: false,
  isLinux: false,
};

export function normalizePath(p: string) { return p; }

export class TFile {
  path = '';
  basename = '';
  extension = '';
  constructor() {}
}

export function setIcon(_el: any, _name: string) {}

export class MarkdownRenderer {
  static async render(_app: any, _md: string, _el: any, _path: string, _comp: any) {}
}
