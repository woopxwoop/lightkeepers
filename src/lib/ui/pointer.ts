/**
 * Pointer / click helpers for controls that fire on primary-button
 * `pointerdown`, and reserve `click` for keyboard / synthetic activation
 * (`event.detail === 0`) to avoid double-running during rapid pointer input.
 */

export function handlePointerAction(
  event: PointerEvent,
  action: () => void,
): void {
  if (event.button !== 0) return;
  action();
}

export function handleKeyboardClick(
  event: MouseEvent,
  action: () => void,
): void {
  if (event.detail === 0) action();
}
