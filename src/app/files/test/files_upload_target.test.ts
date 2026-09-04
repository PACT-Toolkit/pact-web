import { describe, expect, it } from 'vitest';

// PACT-924: the global files MSW handlers register a PUT handler for the
// presigned upload target (mock-object-storage.local) so a raw PUT to any
// URL the presign step hands out succeeds, independent of the uploadFile()
// protocol helper covered by upload_file.test.ts.
describe('files MSW handlers - presigned upload PUT target', () => {
  it('answers a PUT to the mock object-storage upload URL with 200 and an ETag', async () => {
    const response = await fetch(
      'https://mock-object-storage.local/upload/some-file-id',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Blob(['hello world']),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBeTruthy();
  });
});
