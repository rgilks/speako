import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

const STORAGE_KEY = 'speako-selected-microphone';

export function useAudioDevices(
  selectedDeviceId: string,
  onDeviceChange: (deviceId: string) => void
) {
  const devices = useSignal<AudioDevice[]>([]);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first (needed to get device labels)
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}...`,
          }));

        devices.value = audioInputs;
        loading.value = false;

        // Try to restore saved device, or auto-select first
        if (!selectedDeviceId && audioInputs.length > 0) {
          const savedDeviceId = localStorage.getItem(STORAGE_KEY);
          const savedDeviceExists =
            savedDeviceId && audioInputs.some((d) => d.deviceId === savedDeviceId);

          if (savedDeviceExists) {
            onDeviceChange(savedDeviceId);
          } else {
            onDeviceChange(audioInputs[0].deviceId);
          }
        }
      } catch (e) {
        console.error('[DevicePicker] Error loading devices:', e);
        error.value = 'Could not access microphones';
        loading.value = false;
      }
    }

    loadDevices();

    // Listen for device changes (plug/unplug)
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSelection = (deviceId: string) => {
    localStorage.setItem(STORAGE_KEY, deviceId);
    onDeviceChange(deviceId);
  };

  return { devices, loading, error, saveSelection };
}
