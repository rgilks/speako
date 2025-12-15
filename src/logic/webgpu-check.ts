interface NavigatorGPU {
  gpu: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestAdapter: () => Promise<any>;
  };
}

const IOS_DEVICE_PATTERN = /iPad|iPhone|iPod/;
const SAFARI_PATTERN = /Safari/;
const NON_SAFARI_BROWSERS = /Chrome|CriOS|FxiOS/;
const MACINTEL_PLATFORM = 'MacIntel';
const MIN_TOUCH_POINTS = 1;

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS =
    IOS_DEVICE_PATTERN.test(ua) ||
    (navigator.platform === MACINTEL_PLATFORM && navigator.maxTouchPoints > MIN_TOUCH_POINTS);
  const isSafari = SAFARI_PATTERN.test(ua) && !NON_SAFARI_BROWSERS.test(ua);
  return isIOS && isSafari;
}

const IOS_SAFARI_MESSAGE =
  'Using WASM on iOS Safari for stability. WebGPU ML support is still experimental on this platform.';
const UNSUPPORTED_BROWSER_MESSAGE =
  'WebGPU is not supported in this browser. Please use Chrome, Edge, or a browser with WebGPU support.';
const NO_ADAPTER_MESSAGE =
  'WebGPU is supported but no adapter was found. Check your hardware acceleration settings.';

export async function checkWebGPU(): Promise<{ isAvailable: boolean; message?: string }> {
  if (isIOSSafari()) {
    return {
      isAvailable: false,
      message: IOS_SAFARI_MESSAGE,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any as NavigatorGPU;
  if (!nav.gpu) {
    return {
      isAvailable: false,
      message: UNSUPPORTED_BROWSER_MESSAGE,
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        isAvailable: false,
        message: NO_ADAPTER_MESSAGE,
      };
    }
    return { isAvailable: true };
  } catch (error) {
    return {
      isAvailable: false,
      message: `WebGPU error: ${error}`,
    };
  }
}
