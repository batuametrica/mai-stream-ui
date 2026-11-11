// mAI'nin maç önü verisini ürettiği ligler: etl/mai_consensus/config.py LEAGUE_MAPPING ile aynı tutulur.
// Sıra, mobil maç listesindeki lig sırasıdır (Maçkolik'teki gibi önce Türkiye, sonra Avrupa kupaları).
export type League = { key: string; label: string; country: string; competitionId: string; seasonId: string };

export const LEAGUES: League[] = [
  { key: "trendyol-super-lig-turkiye", label: "Trendyol Süper Lig", country: "Türkiye", competitionId: "482ofyysbdbeoxauk19yg7tdt", seasonId: "e00dq6lfzgc7vo631cz8ktc0k" },
  { key: "1lig-turkiye", label: "Trendyol 1. Lig", country: "Türkiye", competitionId: "2o9svokc5s7diish3ycrzk7jm", seasonId: "9vlcn0hdb4ufq9s8e7kjnfn6c" },
  { key: "ziraat-turkiye-kupasi-turkiye", label: "Ziraat Türkiye Kupası", country: "Türkiye", competitionId: "7af85xa75vozt2l4hzi6ryts7", seasonId: "97dlecwglyglcukbl0gus44yc" },
  { key: "uefa-sampiyonlar-ligi-avrupa", label: "Şampiyonlar Ligi", country: "Avrupa", competitionId: "4oogyu6o156iphvdvphwpck10", seasonId: "99jev9kv55deht65t6myggxlg" },
  { key: "uefa-avrupa-ligi-avrupa", label: "Avrupa Ligi", country: "Avrupa", competitionId: "4c1nfi2j1m731hcay25fcgndq", seasonId: "1rpi0q64a7kut2wiuvecmgbv8" },
  { key: "uefa-konferans-ligi-avrupa", label: "Konferans Ligi", country: "Avrupa", competitionId: "c7b8o53flg36wbuevfzy3lb10", seasonId: "acatl9aedc5l4im3r8l890y6s" },
  { key: "uefa-uluslar-ligi-avrupa", label: "UEFA Uluslar Ligi", country: "Avrupa", competitionId: "595nsvo7ykvoe690b1e4u5n56", seasonId: "7wshhtqrzmwrkkygjqf9l0idw" },
  { key: "premier-lig-ingiltere", label: "Premier Lig", country: "İngiltere", competitionId: "2kwbbcootiqqgmrzs6o5inle5", seasonId: "6pdwluctev9iebv00r4qqukno" },
  { key: "laliga-ispanya", label: "LaLiga", country: "İspanya", competitionId: "34pl8szyvrbwcmfkuocjm3r6t", seasonId: "830epggffy1nfkfyrtpqdwhlg" },
  { key: "serie-a-italya", label: "Serie A", country: "İtalya", competitionId: "1r097lpxe0xn03ihb7wi98kao", seasonId: "60cryos85i4bp5ul34tt0brx0" },
  { key: "bundesliga-almanya", label: "Bundesliga", country: "Almanya", competitionId: "6by3h89i2eykc341oz7lv1ddd", seasonId: "8h5xijv2u4mlf5028gso6kw7o" },
  { key: "ligue-1-fransa", label: "Ligue 1", country: "Fransa", competitionId: "dm5ka0os1e3dxcp3vh05kmp33", seasonId: "bqnc4ccgnrp6pb3bktqet0yz8" },
  { key: "eredivisie-hollanda", label: "Eredivisie", country: "Hollanda", competitionId: "akmkihra9ruad09ljapsm84b3", seasonId: "56cvval3nf96u0bf9rzs9h6vo" },
  { key: "primeira-liga-portekiz", label: "Liga Portugal", country: "Portekiz", competitionId: "8yi6ejjd1zudcqtbn07haahg6", seasonId: "a8xa8yfi2tlljxrwyxcst51xw" },
  { key: "pro-league-belcika", label: "Pro Lig", country: "Belçika", competitionId: "4zwgbb66rif2spcoeeol2motx", seasonId: "5ysazl26p4ksxbonjpbamevpw" },
];

// Mobil listede gösterilen gün sayısı: bugün dahil 3 takvim günü (İstanbul saati). Maç önü ETL'i de 3 gün ileriye bakar.
export const MATCH_WINDOW_DAYS = 3;
export const MATCH_TIME_ZONE = "Europe/Istanbul";
