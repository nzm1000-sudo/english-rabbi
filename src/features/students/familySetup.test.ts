import { birthYearFromAge, decodeFamily, encodeFamily } from './familySetup';

describe('family setup link', () => {
  it('round-trips names and ages', () => {
    const fam = [{ name: 'נעה', age: 17 }, { name: 'בארי יעקב', age: 11 }];
    expect(decodeFamily(decodeURIComponent(encodeFamily(fam)))).toEqual(fam);
  });

  it('ignores garbage safely', () => {
    expect(decodeFamily('not json')).toEqual([]);
    expect(decodeFamily('{"n":"x"}')).toEqual([]);
    expect(decodeFamily('[{"n":""},{"n":"ok","a":999}]')).toEqual([{ name: 'ok' }]);
  });

  it('derives birth year', () => {
    expect(birthYearFromAge(12, new Date('2026-10-02'))).toBe(2014);
  });
});
