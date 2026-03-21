// Skins locais do Webamp - RareGroove HI-FI
// Skins reais do Internet Archive com CORS
// ws://skin-museum-og-captbaritone-webamp.vercel.app/api/og

export const LOCAL_SKINS = [
  {
    id: 'classic_green',
    name: 'Classic Green',
    description: 'O Winamp clássico verde original',
    url: '/assets/webamp/skins/classic_green.wsz',
    preview: 'https://archive.org/cors/winampskin_Classic_Green_1/00_coverscreenshot.png',
  },
  {
    id: 'green_amp',
    name: 'Green Amp',
    description: 'Design moderno estilo amplificador',
    url: '/assets/webamp/skins/green_amp.wsz',
    preview: null,
  },
];

export const DEFAULT_SKIN_ID = 'classic_green';

export function getSkinById(id) {
  return LOCAL_SKINS.find(skin => skin.id === id) || LOCAL_SKINS[0];
}

export function getSkinFromLocalStorage() {
  const savedId = localStorage.getItem('grooveflix_skin_id');
  if (savedId) {
    return getSkinById(savedId);
  }
  return getSkinById(DEFAULT_SKIN_ID);
}
