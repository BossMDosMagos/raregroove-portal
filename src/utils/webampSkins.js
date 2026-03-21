// Skins locais do Webamp - RareGroove HI-FI
// Adicione arquivos .wsz na pasta /public/assets/webamp/skins/

export const LOCAL_SKINS = [
  {
    id: 'classic',
    name: 'Classic Hi-Fi',
    description: 'Winamp Classic Original',
    url: '/assets/webamp/skins/classic.wsz',
    preview: null,
  },
  {
    id: 'dark',
    name: 'Dark Groove',
    description: 'Tema escuro RareGroove',
    url: '/assets/webamp/skins/dark.wsz',
    preview: null,
  },
  {
    id: 'pioneer',
    name: 'Pioneer CDJ',
    description: 'Visual de CDJ Profissional',
    url: '/assets/webamp/skins/pioneer.wsz',
    preview: null,
  },
  {
    id: 'technics',
    name: 'Technics 1200',
    description: 'Toca-discos clássico',
    url: '/assets/webamp/skins/technics.wsz',
    preview: null,
  },
];

export const DEFAULT_SKIN_ID = 'classic';

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
