export const DOMESTIC_BANKS = [
  // ── UK Banks ──────────────────────────────────────────────────────────────
  { code: 'LMN',  name: 'Lumina Bank',             swift: 'LMNIGB2L' },
  { code: 'BARC', name: 'Barclays',                swift: 'BARCGB22' },
  { code: 'HSBC', name: 'HSBC UK',                 swift: 'HBUKGB4B' },
  { code: 'LOYD', name: 'Lloyds Bank',             swift: 'LOYDGB2L' },
  { code: 'NWBK', name: 'NatWest',                 swift: 'NWBKGB2L' },
  { code: 'SCBL', name: 'Standard Chartered',      swift: 'SCBLGB2L' },
  { code: 'MONZ', name: 'Monzo',                   swift: 'MONZGB2L' },
  { code: 'RVLT', name: 'Revolut',                 swift: 'RVLTGB2L' },
  { code: 'STRL', name: 'Starling Bank',           swift: 'SRLGGB3L' },
  { code: 'SANT', name: 'Santander UK',            swift: 'ABBYGB2L' },
  { code: 'CREX', name: 'Crypto Exchange',         swift: 'CREXGB00' },
  // ── Energy ────────────────────────────────────────────────────────────────
  { code: 'BGUK', name: 'British Gas',             swift: 'BGUKGB2L' },
  { code: 'EONK', name: 'E.ON',                    swift: 'EONKGB2L' },
  { code: 'EDFK', name: 'EDF Energy',              swift: 'EDFKGB2L' },
  { code: 'OCTK', name: 'Octopus Energy',          swift: 'OCTKGB2L' },
  { code: 'OVOK', name: 'OVO Energy',              swift: 'OVOKGB2L' },
  { code: 'PGEU', name: 'PG&E',                    swift: 'PGEUUS2L' },
  { code: 'DUKU', name: 'Duke Energy',             swift: 'DUKUUS2L' },
  { code: 'AGLA', name: 'AGL Energy',              swift: 'AGLAAU2L' },
  { code: 'ORIA', name: 'Origin Energy',           swift: 'ORIAAU2L' },
  // ── Water ─────────────────────────────────────────────────────────────────
  { code: 'THWK', name: 'Thames Water',            swift: 'THWKGB2L' },
  { code: 'ANGK', name: 'Anglian Water',           swift: 'ANGKGB2L' },
  { code: 'SEVK', name: 'Severn Trent',            swift: 'SEVKGB2L' },
  { code: 'YRKK', name: 'Yorkshire Water',         swift: 'YRKKGB2L' },
  { code: 'SYDA', name: 'Sydney Water',            swift: 'SYDAAU2L' },
  // ── Internet & TV ─────────────────────────────────────────────────────────
  { code: 'BTTK', name: 'BT',                      swift: 'BTTKGB2L' },
  { code: 'SKYK', name: 'Sky',                     swift: 'SKYKGB2L' },
  { code: 'VIRK', name: 'Virgin Media',            swift: 'VIRKGB2L' },
  { code: 'TALK', name: 'TalkTalk',                swift: 'TALKGB2L' },
  { code: 'COMU', name: 'Comcast Xfinity',         swift: 'COMUUS2L' },
  { code: 'ROGC', name: 'Rogers',                  swift: 'ROGCCA2L' },
  { code: 'TELA', name: 'Telstra',                 swift: 'TELAAU2L' },
  // ── Mobile ────────────────────────────────────────────────────────────────
  { code: 'EEUK', name: 'EE',                      swift: 'EEUKGB2L' },
  { code: 'O2UK', name: 'O2',                      swift: 'O2UKGB2L' },
  { code: 'VODK', name: 'Vodafone',                swift: 'VODKGB2L' },
  { code: 'THRK', name: 'Three',                   swift: 'THRKGB2L' },
  { code: 'GIFK', name: 'giffgaff',               swift: 'GIFKGB2L' },
  { code: 'TMBU', name: 'T-Mobile',               swift: 'TMBUUS2L' },
  { code: 'VZWU', name: 'Verizon',                swift: 'VZWUUS2L' },
  { code: 'BELC', name: 'Bell',                    swift: 'BELCCA2L' },
  { code: 'TELC', name: 'Telus',                   swift: 'TELCCA2L' },
  // ── Council Tax ───────────────────────────────────────────────────────────
  { code: 'WCCK', name: 'Westminster City Council',swift: 'WCCKGB2L' },
  { code: 'BCCK', name: 'Birmingham City Council', swift: 'BCCKGB2L' },
  { code: 'MCCK', name: 'Manchester City Council', swift: 'MCCKGB2L' },
  { code: 'LCCK', name: 'Leeds City Council',      swift: 'LCCKGB2L' },
  // ── Tax & Government ──────────────────────────────────────────────────────
  { code: 'HMRK', name: 'HMRC',                   swift: 'HMRKGB2L' },
  { code: 'TVLK', name: 'TV Licensing',            swift: 'TVLKGB2L' },
  { code: 'IRSU', name: 'IRS',                     swift: 'IRSUUS2L' },
  { code: 'CRAC', name: 'Canada Revenue Agency',   swift: 'CRACCA2L' },
  { code: 'ATOA', name: 'Australian Tax Office',   swift: 'ATOAAU2L' },
  // ── Insurance ─────────────────────────────────────────────────────────────
  { code: 'AVVK', name: 'Aviva',                   swift: 'AVVKGB2L' },
  { code: 'AXAK', name: 'AXA',                     swift: 'AXAKGB2L' },
  { code: 'GEIU', name: 'GEICO',                   swift: 'GEIUUS2L' },
  { code: 'STFU', name: 'State Farm',              swift: 'STFUUS2L' },
  // ── Streaming ─────────────────────────────────────────────────────────────
  { code: 'NETG', name: 'Netflix',                 swift: 'NETGXX2L' },
  { code: 'DISG', name: 'Disney+',                 swift: 'DISGXX2L' },
  { code: 'AMZG', name: 'Amazon Prime Video',      swift: 'AMZGXX2L' },
  { code: 'APLG', name: 'Apple',                   swift: 'APLGXX2L' },
  { code: 'NOWG', name: 'NOW TV',                  swift: 'NOWGXX2L' },
  { code: 'HLUG', name: 'Hulu',                    swift: 'HLUGXX2L' },
  { code: 'ITVG', name: 'ITVX',                   swift: 'ITVGXX2L' },
  // ── Music ─────────────────────────────────────────────────────────────────
  { code: 'SPOG', name: 'Spotify',                 swift: 'SPOGXX2L' },
  { code: 'YTMG', name: 'YouTube Music',           swift: 'YTMGXX2L' },
  { code: 'TIDG', name: 'Tidal',                   swift: 'TIDGXX2L' },
  { code: 'DEEG', name: 'Deezer',                  swift: 'DEEGXX2L' },
  // ── Shopping / BNPL ───────────────────────────────────────────────────────
  { code: 'KLNG', name: 'Klarna',                  swift: 'KLNGXX2L' },
  { code: 'CLPG', name: 'Clearpay',               swift: 'CLPGXX2L' },
  // ── Transport ─────────────────────────────────────────────────────────────
  { code: 'TFLK', name: 'Transport for London',    swift: 'TFLKGB2L' },
  { code: 'DVLK', name: 'DVLA',                   swift: 'DVLKGB2L' },
  { code: 'DARK', name: 'Dart Charge',             swift: 'DARKGB2L' },
  { code: 'EZPU', name: 'E-ZPass',                 swift: 'EZPUUS2L' },
  // ── Education ─────────────────────────────────────────────────────────────
  { code: 'SLCK', name: 'Student Loans Company',   swift: 'SLCKGB2L' },
  { code: 'CORG', name: 'Coursera',                swift: 'CORGXX2L' },
  { code: 'UDEG', name: 'Udemy',                   swift: 'UDEGXX2L' },
] as const;

export const INTERNATIONAL_SWIFTS: Record<string, string> = {
  HSBC: 'HBUKGB4B',
  BARCLAYS: 'BARCGB22',
  DEUTSCHE: 'DEUTDEDB',
  BNP: 'BNPAFRPP',
  SANTANDER: 'BSCHESMM',
  ING: 'INGBNL2A',
  UNICREDIT: 'UNCRITMM',
  SOCIETE: 'SOGEFRPP',
};

export function getBankByCode(code: string) {
  return DOMESTIC_BANKS.find((b) => b.code === code) ?? null;
}
