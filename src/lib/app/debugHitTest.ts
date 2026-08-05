type DebugWindow = Window & {
  __lkDebugHitTest?: {
    enable: () => void;
    disable: () => void;
    status: () => boolean;
  };
};

function attachHitTestLogging(): () => void {
  const logEvent = (event: MouseEvent | PointerEvent) => {
    const target = event.target as Element | null;
    const elementAtPoint = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );

    console.log("[LK HITTEST]", {
      type: event.type,
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      buttons: event.buttons,
      defaultPrevented: event.defaultPrevented,
      pointerType: event instanceof PointerEvent ? event.pointerType : null,
      target,
      elementAtPoint,
      targetPath: target?.closest("[class]")?.className ?? null,
      atPointPath: elementAtPoint?.closest("[class]")?.className ?? null,
      activeRoute: location.pathname,
    });
  };

  const errorHandler = (event: ErrorEvent) => {
    console.error("[LK HITTEST ERROR]", event.error ?? event.message);
  };

  document.addEventListener("pointerdown", logEvent, true);
  document.addEventListener("click", logEvent, true);
  window.addEventListener("error", errorHandler);
  console.info("[LK HITTEST] enabled");

  return () => {
    document.removeEventListener("pointerdown", logEvent, true);
    document.removeEventListener("click", logEvent, true);
    window.removeEventListener("error", errorHandler);
    console.info("[LK HITTEST] disabled");
  };
}

/**
 * Dev-only debug helper.
 *
 * In the browser console:
 *   window.__lkDebugHitTest.enable()
 *   window.__lkDebugHitTest.disable()
 *   window.__lkDebugHitTest.status()
 */
export function installDebugHitTest(): () => void {
  if (!import.meta.env.DEV) return () => {};

  const debugWindow = window as DebugWindow;

  let detach: (() => void) | null = null;
  const isEnabled = () => localStorage.getItem("lk_debug_hit_test") === "1";

  const sync = () => {
    if (isEnabled() && !detach) detach = attachHitTestLogging();
    if (!isEnabled() && detach) {
      detach();
      detach = null;
    }
  };

  debugWindow.__lkDebugHitTest = {
    enable: () => {
      localStorage.setItem("lk_debug_hit_test", "1");
      sync();
    },
    disable: () => {
      localStorage.setItem("lk_debug_hit_test", "0");
      sync();
    },
    status: () => isEnabled(),
  };

  sync();

  return () => {
    if (detach) detach();
    detach = null;
  };
}
