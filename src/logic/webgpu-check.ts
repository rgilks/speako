// WebGPU types extension
interface NavigatorGPU {
  gpu: {
    requestAdapter: () => Promise<any>;
  };
}

/**
 * Check if WebGPU is available in the current browser.
 */
export async function checkWebGPU(): Promise<{ isAvailable: boolean; message?: string }> {
  const nav = navigator as any as NavigatorGPU;
  if (!nav.gpu) {
    return {
      isAvailable: false,
      message: "WebGPU is not supported in this browser. Please use Chrome, Edge, or a browser with WebGPU support."
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        isAvailable: false,
        message: "WebGPU is supported but no adapter was found. Check your hardware acceleration settings."
      };
    }
    return { isAvailable: true };
  } catch (e) {
    return {
      isAvailable: false,
      message: `WebGPU error: ${e}`
    };
  }
}
