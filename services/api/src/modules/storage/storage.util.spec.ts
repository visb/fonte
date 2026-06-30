import { computeOrphans, extractImageUrls } from './storage.util';

const BASE = 'https://s3.test/mybucket';

describe('extractImageUrls (story 93)', () => {
  it('returns [] for empty/plain html', () => {
    expect(extractImageUrls('', BASE)).toEqual([]);
    expect(extractImageUrls('<p>no image</p>', BASE)).toEqual([]);
  });

  it('returns [] when there is no bucket base url (non-S3 mode)', () => {
    expect(extractImageUrls(`<img src="${BASE}/a.png">`, null)).toEqual([]);
  });

  it('extracts a single bucket image url', () => {
    expect(extractImageUrls(`<p>x</p><img src="${BASE}/documents/a.png">`, BASE)).toEqual([
      `${BASE}/documents/a.png`,
    ]);
  });

  it('extracts N bucket image urls (both quote styles), de-duplicated', () => {
    const html =
      `<img src="${BASE}/a.png">` +
      `<img src='${BASE}/b.png'>` +
      `<img src="${BASE}/a.png">`; // duplicate
    expect(extractImageUrls(html, BASE)).toEqual([`${BASE}/a.png`, `${BASE}/b.png`]);
  });

  it('strips the presign query, recovering the canonical url', () => {
    const html = `<img src="${BASE}/a.png?X-Amz-Signature=abc&X-Amz-Date=x">`;
    expect(extractImageUrls(html, BASE)).toEqual([`${BASE}/a.png`]);
  });

  it('ignores base64/data and external urls', () => {
    const html =
      `<img src="data:image/png;base64,iVBORw0KG">` +
      `<img src="https://other.cdn/x.png">` +
      `<img src="/uploads/local.png">` +
      `<img src="${BASE}/keep.png">`;
    expect(extractImageUrls(html, BASE)).toEqual([`${BASE}/keep.png`]);
  });
});

describe('computeOrphans (story 93)', () => {
  it('returns bucket keys not referenced by any record', () => {
    const bucket = ['a.png', 'b.png', 'c.png'];
    const referenced = new Set(['b.png']);
    expect(computeOrphans(bucket, referenced)).toEqual(['a.png', 'c.png']);
  });

  it('returns [] when everything is referenced', () => {
    const bucket = ['a.png', 'b.png'];
    expect(computeOrphans(bucket, new Set(['a.png', 'b.png']))).toEqual([]);
  });

  it('returns all keys when nothing is referenced', () => {
    const bucket = ['a.png', 'b.png'];
    expect(computeOrphans(bucket, new Set())).toEqual(['a.png', 'b.png']);
  });
});
