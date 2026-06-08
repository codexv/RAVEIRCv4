// Tiny bridge so the chat area can focus the editbox (mIRC-style).

let inputEl: HTMLInputElement | null = null;

export function registerInput(el: HTMLInputElement | null) {
  inputEl = el;
}

/** Focus the editbox, unless the user is selecting text (don't interrupt). */
export function focusInput() {
  if (window.getSelection()?.toString()) return;
  inputEl?.focus();
}
