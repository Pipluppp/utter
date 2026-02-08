/** Shared test constants and fixtures */

export const TEST_USER_A = {
  email: "test_edge_a@utter-test.com",
  password: "testpass123!",
};

export const TEST_USER_B = {
  email: "test_edge_b@utter-test.com",
  password: "testpass123!",
};

export const VALID_VOICE_PAYLOAD = {
  name: "Test Voice",
  language: "English",
  transcript: "This is a test reference transcript for voice cloning.",
};

export const VALID_GENERATE_PAYLOAD = {
  text: "Hello world, this is a test of the generation pipeline.",
  language: "English",
};

/**
 * Minimal valid WAV file: 44-byte RIFF header + 0 data bytes.
 * PCM 16-bit mono 44100Hz. Used for storage upload tests.
 */
export const MINIMAL_WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x24, 0x00, 0x00, 0x00, // Chunk size: 36 bytes (header only, no data)
  0x57, 0x41, 0x56, 0x45, // "WAVE"
  0x66, 0x6d, 0x74, 0x20, // "fmt "
  0x10, 0x00, 0x00, 0x00, // Subchunk1 size: 16
  0x01, 0x00, // AudioFormat: PCM (1)
  0x01, 0x00, // NumChannels: 1 (mono)
  0x44, 0xac, 0x00, 0x00, // SampleRate: 44100
  0x88, 0x58, 0x01, 0x00, // ByteRate: 88200
  0x02, 0x00, // BlockAlign: 2
  0x10, 0x00, // BitsPerSample: 16
  0x64, 0x61, 0x74, 0x61, // "data"
  0x00, 0x00, 0x00, 0x00, // Subchunk2 size: 0 bytes
]);
