/** Runtime stub for the type-only `obsidian` package in tests. */
export class Modal {
  modalEl: any = { addClass() {} };
  titleEl: any = { setText() {} };
  contentEl: any = {
    createEl() { return { addEventListener() {}, textContent: '', value: '' }; },
    createDiv() {
      const el: any = { addEventListener() {}, createEl() { return { addEventListener() {}, textContent: '', value: '' }; }, children: [] };
      return el;
    },
    empty() {},
  };
  onClose: (() => void) | null = null;
  open(): void {}
  close(): void { this.onClose?.(); }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = { empty() {}, createEl() { return {}; } };
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  display(): void {}
}

export class Setting {
  constructor(_containerEl: any) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addSlider() { return this; }
  addToggle() { return this; }
}

export class Notice {
  constructor(_msg: string, _timeout?: number) {}
}

export class Component {
  load() {}
  unload() {}
}

export function createEl(_tag: string, _opts?: any): any { return {}; }
