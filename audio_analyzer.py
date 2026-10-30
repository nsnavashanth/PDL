import wave
import io
import math
import numpy as np

def parse_wav_bytes(audio_bytes):
    """
    Parses WAV file bytes and returns (samples_float32, sample_rate).
    Supports mono and stereo (converted to mono), 8-bit, 16-bit, and 32-bit PCM.
    """
    try:
        with wave.open(io.BytesIO(audio_bytes), 'rb') as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()

            if n_frames == 0:
                raise ValueError("Audio file contains no frames.")

            raw_data = wf.readframes(n_frames)

            # Determine dtype based on sample width
            if sample_width == 1:
                # 8-bit unsigned
                samples = np.frombuffer(raw_data, dtype=np.uint8).astype(np.float32)
                samples = (samples - 128.0) / 128.0
            elif sample_width == 2:
                # 16-bit signed
                samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32)
                samples = samples / 32768.0
            elif sample_width == 4:
                # 32-bit signed
                samples = np.frombuffer(raw_data, dtype=np.int32).astype(np.float32)
                samples = samples / 2147483648.0
            else:
                raise ValueError(f"Unsupported sample width: {sample_width} bytes")

            # Convert multi-channel to mono
            if n_channels > 1:
                samples = samples.reshape(-1, n_channels).mean(axis=1)

            return samples, framerate
    except Exception as e:
        # If not standard WAV, check if it's raw float32 array or return clear error
        raise ValueError(f"WAV parsing error: {str(e)}. Please provide a valid WAV audio recording.")

def analyze_audio_data(audio_bytes):
    """
    Analyzes scrambling audio and extracts physical acoustic characteristics:
    - RMS Energy (signal power)
    - Peak Amplitude
    - Zero Crossing Rate (ZCR)
    - Spectral Centroid (mean frequency weighted by amplitude)
    - Spectral Roll-off (85% energy frequency)
    - Waveform downsample for fast UI rendering
    """
    try:
        samples, sr = parse_wav_bytes(audio_bytes)
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

    total_samples = len(samples)
    duration_sec = total_samples / float(sr)

    if duration_sec < 0.2:
        return {
            'success': False,
            'error': f"Audio duration too short ({duration_sec:.2f}s). Minimum required is 0.5s of scramble sounds."
        }

    # 1. Signal Energy
    rms_energy = float(np.sqrt(np.mean(samples ** 2)))
    peak_amp = float(np.max(np.abs(samples)))

    # 2. Zero Crossing Rate (ZCR)
    # Count sign changes
    zero_crossings = np.sum(np.abs(np.diff(np.sign(samples) > 0)))
    zcr = float(zero_crossings / max(1, total_samples - 1))

    # 3. Frequency Analysis (FFT)
    # Use real FFT
    fft_vals = np.abs(np.fft.rfft(samples))
    freqs = np.fft.rfftfreq(total_samples, d=1.0/sr)

    # Avoid zero division
    sum_fft = np.sum(fft_vals)
    if sum_fft > 1e-9:
        spectral_centroid = float(np.sum(freqs * fft_vals) / sum_fft)

        # Spectral roll-off (85th percentile)
        cum_fft = np.cumsum(fft_vals)
        roll_idx = np.searchsorted(cum_fft, 0.85 * sum_fft)
        spectral_rolloff = float(freqs[min(roll_idx, len(freqs)-1)])
    else:
        spectral_centroid = 0.0
        spectral_rolloff = 0.0

    # 4. Generate downsampled waveform array (100 bins for frontend UI)
    bins = 100
    chunk_size = max(1, total_samples // bins)
    waveform_summary = []
    for b in range(bins):
        start = b * chunk_size
        end = min(total_samples, start + chunk_size)
        if start < total_samples:
            chunk = samples[start:end]
            val = float(np.max(np.abs(chunk))) if len(chunk) > 0 else 0.0
            waveform_summary.append(round(val, 3))
        else:
            waveform_summary.append(0.0)

    # 5. Extract top 3 dominant frequency peaks
    peak_indices = np.argsort(fft_vals)[-3:][::-1]
    dominant_frequencies = [round(float(freqs[idx]), 1) for idx in peak_indices if idx < len(freqs)]

    # 6. Feature descriptor string for entropy pipeline (deterministic representation)
    feature_descriptor = (
        f"SR:{sr}|DUR:{duration_sec:.3f}|RMS:{rms_energy:.5f}|"
        f"PEAK:{peak_amp:.4f}|ZCR:{zcr:.5f}|CENTROID:{spectral_centroid:.1f}|"
        f"ROLLOFF:{spectral_rolloff:.1f}"
    )

    return {
        'success': True,
        'duration_seconds': round(duration_sec, 2),
        'sample_rate': sr,
        'total_samples': total_samples,
        'rms_energy': round(rms_energy, 5),
        'peak_amplitude': round(peak_amp, 4),
        'zero_crossing_rate': round(zcr, 5),
        'spectral_centroid_hz': round(spectral_centroid, 1),
        'spectral_rolloff_hz': round(spectral_rolloff, 1),
        'dominant_frequencies_hz': dominant_frequencies,
        'waveform': waveform_summary,
        'feature_descriptor': feature_descriptor
    }
