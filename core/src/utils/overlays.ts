import { AnimationBuilder, HTMLIonOverlayElement, IonicConfig, OverlayInterface } from '../interface';

let lastId = 0;

export function createOverlay<T extends HTMLIonOverlayElement>(element: T, opts: object | undefined): Promise<T> {
  const doc = element.ownerDocument;
  connectListeners(doc);

  // convert the passed in overlay options into props
  // that get passed down into the new overlay
  Object.assign(element, opts);
  element.classList.add('ion-page-invisible');
  const overlayIndex = lastId++;
  element.overlayIndex = overlayIndex;
  if (!element.hasAttribute('id')) {
    element.id = `ion-overlay-${overlayIndex}`;
  }

  // append the overlay element to the document body
  getAppRoot(doc).appendChild(element);

  doc.body.addEventListener('keyup', ev => {
    if (ev.key === 'Escape') {
      const lastOverlay = getOverlay(doc);
      if (lastOverlay && lastOverlay.backdropDismiss) {
        // tslint:disable-next-line:no-floating-promises
        lastOverlay.dismiss(null, BACKDROP);
      }
    }
  });

  return element.componentOnReady();
}

export function connectListeners(doc: Document) {
  if (lastId === 0) {
    lastId = 1;
    doc.body.addEventListener('keyup', ev => {
      if (ev.key === 'Escape') {
        const lastOverlay = getOverlay(doc);
        if (lastOverlay && lastOverlay.backdropDismiss) {
          // tslint:disable-next-line:no-floating-promises
          lastOverlay.dismiss('backdrop');
        }
      }
    });
  }
}

export function dismissOverlay(doc: Document, data: any, role: string | undefined, overlayTag: string, id?: string): Promise<boolean> {
  const overlay = getOverlay(doc, overlayTag, id);
  if (!overlay) {
    return Promise.reject('overlay does not exist');
  }
  return overlay.dismiss(data, role);
}

export function getOverlays(doc: Document, overlayTag?: string): HTMLIonOverlayElement[] {
  const overlays = Array.from(getAppRoot(doc).children) as HTMLIonOverlayElement[];
  if (overlayTag === undefined) {
    return overlays;
  }
  overlayTag = overlayTag.toUpperCase();
  return overlays.filter(c => c.tagName === overlayTag);
}

export function getOverlay(doc: Document, overlayTag?: string, id?: string): HTMLIonOverlayElement | undefined {
  const overlays = getOverlays(doc, overlayTag);
  return (id === undefined)
    ? overlays[overlays.length - 1]
    : overlays.find(o => o.id === id);
}

export async function present(
  overlay: OverlayInterface,
  name: keyof IonicConfig,
  iosEnterAnimation: AnimationBuilder,
  mdEnterAnimation: AnimationBuilder,
  opts?: any
) {
  if (overlay.presented) {
    return;
  }
  overlay.presented = true;
  overlay.willPresent.emit();

  // get the user's animation fn if one was provided
  const animationBuilder = (overlay.enterAnimation)
    ? overlay.enterAnimation
    : overlay.config.get(name, overlay.mode === 'ios' ? iosEnterAnimation : mdEnterAnimation);

  await overlayAnimation(overlay, animationBuilder, overlay.el, opts);

  overlay.didPresent.emit();
}

export async function dismiss(
  overlay: OverlayInterface,
  data: any | undefined,
  role: string | undefined,
  name: keyof IonicConfig,
  iosLeaveAnimation: AnimationBuilder,
  mdLeaveAnimation: AnimationBuilder,
  opts?: any
): Promise<boolean> {
  if (!overlay.presented) {
    return false;
  }
  overlay.presented = false;

  overlay.willDismiss.emit({ data, role });

  const animationBuilder = (overlay.leaveAnimation)
    ? overlay.leaveAnimation
    : overlay.config.get(name, overlay.mode === 'ios' ? iosLeaveAnimation : mdLeaveAnimation);

  await overlayAnimation(overlay, animationBuilder, overlay.el, opts);

  overlay.didDismiss.emit({ data, role });
  overlay.el.remove();
  return true;
}

function getAppRoot(doc: Document) {
  return doc.querySelector('ion-app') || doc.body;
}

async function overlayAnimation(
  overlay: OverlayInterface,
  animationBuilder: AnimationBuilder,
  baseEl: HTMLElement,
  opts: any
): Promise<void> {
  if (overlay.animation) {
    overlay.animation.destroy();
    overlay.animation = undefined;
  }

  // Make overlay visible in case it's hidden
  baseEl.classList.remove('ion-page-invisible');

  const aniRoot = baseEl.shadowRoot || overlay.el;
  const animation = overlay.animation = await overlay.animationCtrl.create(animationBuilder, aniRoot, opts);
  overlay.animation = animation;
  if (!overlay.animated) {
    animation.duration(0);
  }
  if (overlay.keyboardClose) {
    animation.beforeAddWrite(() => {
      const activeElement = baseEl.ownerDocument.activeElement as HTMLElement;
      if (activeElement && activeElement.matches('input, ion-input, ion-textarea')) {
        activeElement.blur();
      }
    });
  }
  await animation.playAsync();

  animation.destroy();
  overlay.animation = undefined;
}

export function autoFocus(containerEl: HTMLElement): HTMLElement | undefined {
  const focusableEls = containerEl.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]');
  if (focusableEls.length > 0) {
    const el = focusableEls[0] as HTMLInputElement;
    el.focus();
    return el;
  }
  return undefined;
}

export function eventMethod<T>(element: HTMLElement, eventName: string): Promise<T> {
  let resolve: (detail: T) => void;
  const promise = new Promise<T>(r => resolve = r);
  onceEvent(element, eventName, (event: any) => {
    resolve(event.detail);
  });
  return promise;
}

export function onceEvent(element: HTMLElement, eventName: string, callback: (ev: Event) => void) {
  const handler = (ev: Event) => {
    element.removeEventListener(eventName, handler);
    callback(ev);
  };
  element.addEventListener(eventName, handler);
}

export function isCancel(role: string | undefined): boolean {
  return role === 'cancel' || role === BACKDROP;
}

export const BACKDROP = 'backdrop';
