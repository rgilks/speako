import { useEffect, useCallback, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

const STORAGE_KEY = 'speako-selected-microphone';
const DEVICE_ID_PREVIEW_LENGTH = 8;
const FALLBACK_LABEL_PREFIX = 'Microphone';

function getDeviceLabel(device: MediaDeviceInfo): string {
  return (
    device.label ||
    `${FALLBACK_LABEL_PREFIX} ${device.deviceId.slice(0, DEVICE_ID_PREVIEW_LENGTH)}...`
  );
}

function mapToAudioDevices(mediaDevices: MediaDeviceInfo[]): AudioDevice[] {
  return mediaDevices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({
      deviceId: d.deviceId,
      label: getDeviceLabel(d),
    }));
}

function selectInitialDevice(
  audioInputs: AudioDevice[],
  currentDeviceId: string,
  onDeviceChange: (deviceId: string) => void
) {
  if (currentDeviceId || audioInputs.length === 0) return;

  const savedDeviceId = localStorage.getItem(STORAGE_KEY);
  const savedDeviceExists = savedDeviceId && audioInputs.some((d) => d.deviceId === savedDeviceId);

  if (savedDeviceExists) {
    onDeviceChange(savedDeviceId);
  } else {
    onDeviceChange(audioInputs[0].deviceId);
  }
}

export function useAudioDevices(
  selectedDeviceId: string,
  onDeviceChange: (deviceId: string) => void
) {
  const devices = useSignal<AudioDevice[]>([]);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const onDeviceChangeRef = useRef(onDeviceChange);
  const selectedDeviceIdRef = useRef(selectedDeviceId);

  useEffect(() => {
    onDeviceChangeRef.current = onDeviceChange;
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [onDeviceChange, selectedDeviceId]);

  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first (needed to get device labels)
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = mapToAudioDevices(allDevices);

        devices.value = audioInputs;
        loading.value = false;

        selectInitialDevice(audioInputs, selectedDeviceIdRef.current, onDeviceChangeRef.current);
      } catch (e) {
        console.error('[useAudioDevices] Error loading devices:', e);
        error.value = 'Could not access microphones';
        loading.value = false;
      }
    }

    loadDevices();

    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
    // Signals are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSelection = useCallback(
    (deviceId: string) => {
      localStorage.setItem(STORAGE_KEY, deviceId);
      onDeviceChange(deviceId);
    },
    [onDeviceChange]
  );

  return { devices, loading, error, saveSelection };
}
