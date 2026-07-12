import {
  confirmFileUpload,
  requestFileUpload,
} from '@/src/__codegen__/rest/files';

// UploadFileFailureStep identifies which leg of the presign -> PUT -> confirm
// protocol failed, so a caller can map it onto user-facing copy without
// re-deriving which request was in flight.
export type UploadFileFailureStep = 'presign' | 'put' | 'confirm';

export interface UploadFileFailure {
  step: UploadFileFailureStep;
  status: number;
}

export type UploadFileResult =
  | { ok: true; fileId: string }
  | { ok: false; failure: UploadFileFailure };

// uploadFile runs the three-step upload protocol pact-files expects: request
// a presigned PUT URL from the gateway, PUT the raw bytes directly to object
// storage, then confirm so pact-files can run MIME detection, virus
// scanning, and thumbnail generation. Returns a structured result identifying
// which step failed and with what HTTP status -- this module holds protocol
// only; mapping a failure onto display copy is a UI concern (FilesWorkbench).
//
// Any thrown exception (network failure, etc.) propagates to the caller
// uncaught -- callers are expected to wrap the call in their own try/catch,
// same as before this was extracted.
export async function uploadFile(file: File): Promise<UploadFileResult> {
  const presign = await requestFileUpload({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    purpose: 'attachment',
  });
  if (presign.status !== 201) {
    return { ok: false, failure: { step: 'presign', status: presign.status } };
  }
  const { fileId, uploadUrl } = presign.data;

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!put.ok) {
    return { ok: false, failure: { step: 'put', status: put.status } };
  }

  const confirm = await confirmFileUpload(fileId);
  if (confirm.status !== 200) {
    return { ok: false, failure: { step: 'confirm', status: confirm.status } };
  }

  return { ok: true, fileId };
}
