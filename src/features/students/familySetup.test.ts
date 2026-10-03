import { birthYearFromAge, decodeFamily, encodeFamily } from './familySetup';

describe('family setup link', () => {
  it('round-trips names and ages', () => {
    const fam = [{ name: 'דנה', age: 14 }, { name: 'עומר בן', age: 10 }];
    expect(decodeFamily(decodeURIComponent(encodeFamily(fam)))).toEqual(fam);
  });

  it('ignores garbage safely', () => {
    expect(decodeFamily('not json')).toEqual([]);
    expect(decodeFamily('{"n":"x"}')).toEqual([]);
    expect(decodeFamily('[{"n":""},{"n":"ok","a":999}]')).toEqual([{ name: 'ok' }]);
  });

  it('drops a repeated name', () => {
    expect(decodeFamily('[{"n":"Dana","a":9},{"n":" dana "},{"n":"Ori"}]')).toEqual([{ name: 'Dana', age: 9 }, { name: 'Ori' }]);
  });

  it('derives birth year', () => {
    expect(birthYearFromAge(12, new Date('2026-10-02'))).toBe(2014);
  });
});
