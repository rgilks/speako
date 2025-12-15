import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';

interface DevicePickerProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

const STORAGE_KEY = 'speako-selected-microphone';

/**
 * Dropdown to select audio input device.
 * Requires microphone permission to see device labels.
 * Persists selection to localStorage.
 */
export function DevicePicker({ selectedDeviceId, onDeviceChange }: DevicePickerProps) {
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
  }, []);

  // Save selection to localStorage when it changes
  const handleDeviceChange = (deviceId: string) => {
    localStorage.setItem(STORAGE_KEY, deviceId);
    onDeviceChange(deviceId);
  };

  if (loading.value) {
    return <p className="text-muted text-sm">Loading devices...</p>;
  }

  if (error.value) {
    return (
      <p className="text-muted text-sm" style={{ color: 'var(--accent-error)' }}>
        {error.value}
      </p>
    );
  }

  if (devices.value.length === 0) {
    return <p className="text-muted text-sm">No microphones found</p>;
  }

  // Don't show dropdown if only one microphone available
  if (devices.value.length === 1) {
    return null;
  }

  return (
    <div className="device-picker">
      <label className="device-picker-label">🎤 Microphone</label>
      <select
        className="device-picker-select"
        value={selectedDeviceId}
        onChange={(e) => handleDeviceChange((e.target as HTMLSelectElement).value)}
      >
        {devices.value.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );
}
