import { useAudioDevices } from '../hooks/useAudioDevices';

interface DevicePickerProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
}

/**
 * Dropdown to select audio input device.
 * Requires microphone permission to see device labels.
 * Persists selection to localStorage.
 */
export function DevicePicker({ selectedDeviceId, onDeviceChange }: DevicePickerProps) {
  const { devices, loading, error, saveSelection } = useAudioDevices(
    selectedDeviceId,
    onDeviceChange
  );

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
        onChange={(e) => saveSelection((e.target as HTMLSelectElement).value)}
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
