// Browser-only file-download helper shared by every feature that lets a
// user save something they were just shown (an account data export, MFA
// recovery codes, ...) as a local file. Moved here from
// src/app/account/ui/settings/helpers.ts the moment a second feature
// (auth's recovery-codes card) needed it - see the "Web framework shared
// code" convention: reusable code lives in src/framework/ from its first
// cross-feature use, never duplicated per feature.

// triggerDownload triggers a browser file download from an in-memory
// Blob. The URL is revoked on the next tick -- long enough for the
// browser to start the transfer before garbage-collecting the handle.
export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
