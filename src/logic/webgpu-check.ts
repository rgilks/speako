// WebGPU types extension
interface NavigatorGPU {
  gpu: {
    requestAdapter: () => Promise<any>;
  };
}

/**
 * Check if running on iOS Safari where WebGPU is unstable for ML workloads.
 */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Check if WebGPU is available in the current browser.
 */
export async function checkWebGPU(): Promise<{ isAvailable: boolean; message?: string }> {
  // iOS Safari has WebGPU API but it's unstable for ML workloads and can crash the browser
  if (isIOSSafari()) {
    console.log('[WebGPU] iOS Safari detected - using WASM for stability');
    return {
      isAvailable: false,
      message:
        'Using WASM on iOS Safari for stability. WebGPU ML support is still experimental on this platform.',
    };
  }

  const nav = navigator as any as NavigatorGPU;
  if (!nav.gpu) {
    return {
      isAvailable: false,
      message:
        'WebGPU is not supported in this browser. Please use Chrome, Edge, or a browser with WebGPU support.',
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        isAvailable: false,
        message:
          'WebGPU is supported but no adapter was found. Check your hardware acceleration settings.',
      };
    }
    return { isAvailable: true };
  } catch (e) {
    return {
      isAvailable: false,
      message: `WebGPU error: ${e}`,
    };
  }
}
