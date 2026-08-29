import {
  computeOrphans,
  extractImageUrls,
  rebaseHtmlStorageUrls,
  rebaseStorageUrl,
} from './storage.util';

const BASE = 'https://s3.test/mybucket';
const FROM = 'https://t3.storageapi.dev/old-bucket';
const TO = 'https://static.fontedemisericordia.com.br/fonte';

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

describe('rebaseStorageUrl (story 188)', () => {
  it('swaps the base, keeping the object key', () => {
    expect(rebaseStorageUrl(`${FROM}/residents/a.jpg`, FROM, TO)).toBe(
      `${TO}/residents/a.jpg`,
    );
  });

  it('strips the presign query, recovering the canonical url', () => {
    const signed = `${FROM}/residents/a.jpg?X-Amz-Signature=abc&X-Amz-Date=x`;
    expect(rebaseStorageUrl(signed, FROM, TO)).toBe(`${TO}/residents/a.jpg`);
  });

  it('is idempotent: a url already on the target base is untouched', () => {
    const once = rebaseStorageUrl(`${FROM}/residents/a.jpg`, FROM, TO);
    expect(rebaseStorageUrl(once, FROM, TO)).toBe(once);
  });

  it('leaves external, local and data urls untouched', () => {
    expect(rebaseStorageUrl('https://other.cdn/x.png', FROM, TO)).toBe(
      'https://other.cdn/x.png',
    );
    expect(rebaseStorageUrl('/uploads/residents/a.jpg', FROM, TO)).toBe(
      '/uploads/residents/a.jpg',
    );
    expect(rebaseStorageUrl('data:image/png;base64,iVBOR', FROM, TO)).toBe(
      'data:image/png;base64,iVBOR',
    );
  });

  it('does not match a base that is only a prefix of another bucket name', () => {
    const other = `${FROM}-staging/residents/a.jpg`;
    expect(rebaseStorageUrl(other, FROM, TO)).toBe(other);
  });

  it('preserves nested keys and percent-encoding', () => {
    expect(rebaseStorageUrl(`${FROM}/documents/a%20b/c.pdf`, FROM, TO)).toBe(
      `${TO}/documents/a%20b/c.pdf`,
    );
  });

  it('passes null, undefined and empty string through', () => {
    expect(rebaseStorageUrl(null, FROM, TO)).toBeNull();
    expect(rebaseStorageUrl(undefined, FROM, TO)).toBeUndefined();
    expect(rebaseStorageUrl('', FROM, TO)).toBe('');
  });
});

describe('rebaseHtmlStorageUrls (story 188)', () => {
  it('rebases every bucket <img src>, both quote styles', () => {
    const html = `<img src="${FROM}/a.png"><img src='${FROM}/b.png'>`;
    expect(rebaseHtmlStorageUrls(html, FROM, TO)).toBe(
      `<img src="${TO}/a.png"><img src='${TO}/b.png'>`,
    );
  });

  it('leaves external images alone while rebasing ours', () => {
    const html = `<img src="https://other.cdn/x.png"><img src="${FROM}/a.png">`;
    expect(rebaseHtmlStorageUrls(html, FROM, TO)).toBe(
      `<img src="https://other.cdn/x.png"><img src="${TO}/a.png">`,
    );
  });

  it('does not touch the base url when it appears as body text', () => {
    const html = `<p>Servido por ${FROM}/a.png</p><img src="${FROM}/a.png">`;
    expect(rebaseHtmlStorageUrls(html, FROM, TO)).toBe(
      `<p>Servido por ${FROM}/a.png</p><img src="${TO}/a.png">`,
    );
  });

  it('is idempotent over the whole blob', () => {
    const html = `<img src="${FROM}/a.png">`;
    const once = rebaseHtmlStorageUrls(html, FROM, TO) as string;
    expect(rebaseHtmlStorageUrls(once, FROM, TO)).toBe(once);
  });

  it('passes html without images, null and empty through', () => {
    expect(rebaseHtmlStorageUrls('<p>x</p>', FROM, TO)).toBe('<p>x</p>');
    expect(rebaseHtmlStorageUrls(null, FROM, TO)).toBeNull();
    expect(rebaseHtmlStorageUrls('', FROM, TO)).toBe('');
  });
});
