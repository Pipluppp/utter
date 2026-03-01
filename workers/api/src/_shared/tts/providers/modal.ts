import {
  cancelJob,
  checkJobStatus,
  designVoicePreviewBytes,
  getJobResultBytes,
  type ModalStatusResponse,
  type ModalSubmitPayload,
  type ModalSubmitResponse,
  type ModalVoiceDesignPayload,
  submitJob,
} from "../../modal.ts";

export type {
  ModalStatusResponse,
  ModalSubmitPayload,
  ModalSubmitResponse,
  ModalVoiceDesignPayload,
};

export const modalProvider = {
  submitJob,
  checkJobStatus,
  getJobResultBytes,
  cancelJob,
  designVoicePreviewBytes,
};
