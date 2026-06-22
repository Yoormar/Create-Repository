const TYPE_LABELS = {
  Fire: 'Fuego',
  Water: 'Agua',
  Grass: 'Planta',
  Lightning: 'Eléctrico',
  Psychic: 'Psíquico',
  Fighting: 'Lucha',
  Darkness: 'Siniestro',
  Metal: 'Metálico',
  Dragon: 'Dragón',
  Colorless: 'Incoloro',
};

const FALLBACK_CARDS = [
  {
    id: 'base1-4',
    name: 'Charizard',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '120',
    types: ['Fire'],
    rarity: 'Rare Holo',
    set: { name: 'Base Set', series: 'Base' },
    number: '4',
    images: { large: 'https://images.pokemontcg.io/base1/4_hires.png', small: 'https://images.pokemontcg.io/base1/4.png' },
    attacks: [
      { name: 'Energy Burn', cost: ['Fire'], damage: '', text: 'As often as you like during your turn (before your attack), you may turn all Energy attached to Charizard into Fire Energy for the rest of the turn.' },
      { name: 'Fire Spin', cost: ['Fire', 'Fire', 'Fire', 'Fire'], damage: '100', text: 'Discard 2 Energy cards attached to Charizard in order to use this attack.' },
    ],
  },
  {
    id: 'base1-58',
    name: 'Pikachu',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '40',
    types: ['Lightning'],
    rarity: 'Common',
    set: { name: 'Base Set', series: 'Base' },
    number: '58',
    images: { large: 'https://images.pokemontcg.io/base1/58_hires.png', small: 'https://images.pokemontcg.io/base1/58.png' },
    attacks: [{ name: 'Gnaw', cost: ['Colorless'], damage: '10', text: '' }],
  },
  {
    id: 'base1-15',
    name: 'Venusaur',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '100',
    types: ['Grass'],
    rarity: 'Rare Holo',
    set: { name: 'Base Set', series: 'Base' },
    number: '15',
    images: { large: 'https://images.pokemontcg.io/base1/15_hires.png', small: 'https://images.pokemontcg.io/base1/15.png' },
    attacks: [{ name: 'Solarbeam', cost: ['Grass', 'Grass', 'Grass', 'Grass'], damage: '60', text: '' }],
  },
  {
    id: 'base1-2',
    name: 'Blastoise',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '100',
    types: ['Water'],
    rarity: 'Rare Holo',
    set: { name: 'Base Set', series: 'Base' },
    number: '2',
    images: { large: 'https://images.pokemontcg.io/base1/2_hires.png', small: 'https://images.pokemontcg.io/base1/2.png' },
    attacks: [{ name: 'Hydro Pump', cost: ['Water', 'Water', 'Water', 'Water'], damage: '40+', text: 'Does 40 damage plus 10 more damage for each Water Energy attached to Blastoise but not used to pay for this attack.' }],
  },
  {
    id: 'swsh4-25',
    name: 'Charizard V',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'V'],
    hp: '220',
    types: ['Fire'],
    rarity: 'Rare Holo V',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '25',
    images: { large: 'https://images.pokemontcg.io/swsh4/25_hires.png', small: 'https://images.pokemontcg.io/swsh4/25.png' },
    attacks: [
      { name: 'Claw Slash', cost: ['Colorless', 'Colorless', 'Colorless'], damage: '80', text: '' },
      { name: 'Fire Spin', cost: ['Fire', 'Fire', 'Colorless', 'Colorless', 'Colorless'], damage: '220', text: 'Discard 2 Energy from this Pokémon.' },
    ],
  },
  {
    id: 'swsh4-44',
    name: 'Pikachu V',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'V'],
    hp: '190',
    types: ['Lightning'],
    rarity: 'Rare Holo V',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '44',
    images: { large: 'https://images.pokemontcg.io/swsh4/44_hires.png', small: 'https://images.pokemontcg.io/swsh4/44.png' },
    attacks: [{ name: 'Thunderbolt', cost: ['Lightning', 'Lightning', 'Colorless'], damage: '200', text: 'Discard all Energy from this Pokémon.' }],
  },
  {
    id: 'swsh4-20',
    name: 'Mew V',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'V'],
    hp: '180',
    types: ['Psychic'],
    rarity: 'Rare Holo V',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '20',
    images: { large: 'https://images.pokemontcg.io/swsh4/20_hires.png', small: 'https://images.pokemontcg.io/swsh4/20.png' },
    attacks: [{ name: 'X Ball', cost: ['Colorless', 'Colorless'], damage: '30×', text: "This attack does 30 damage for each Energy attached to both Active Pokémon." }],
  },
  {
    id: 'swsh4-50',
    name: 'Rayquaza V',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'V'],
    hp: '210',
    types: ['Dragon'],
    rarity: 'Rare Holo V',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '50',
    images: { large: 'https://images.pokemontcg.io/swsh4/50_hires.png', small: 'https://images.pokemontcg.io/swsh4/50.png' },
    attacks: [{ name: 'Spiral Burst', cost: ['Fire', 'Lightning'], damage: '20+', text: 'You may discard up to 2 basic Energy from this Pokémon. This attack does 80 more damage for each card you discarded.' }],
  },
  {
    id: 'swsh4-104',
    name: 'Eternatus VMAX',
    supertype: 'Pokémon',
    subtypes: ['VMAX'],
    hp: '340',
    types: ['Darkness'],
    rarity: 'Rare Holo VMAX',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '104',
    images: { large: 'https://images.pokemontcg.io/swsh4/104_hires.png', small: 'https://images.pokemontcg.io/swsh4/104.png' },
    attacks: [{ name: 'Dread End', cost: ['Darkness'], damage: '30×', text: 'This attack does 30 damage for each of your Darkness Pokémon in play.' }],
  },
  {
    id: 'swsh4-136',
    name: 'Zacian V',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'V'],
    hp: '220',
    types: ['Metal'],
    rarity: 'Rare Holo V',
    set: { name: 'Vivid Voltage', series: 'Sword & Shield' },
    number: '136',
    images: { large: 'https://images.pokemontcg.io/swsh4/136_hires.png', small: 'https://images.pokemontcg.io/swsh4/136.png' },
    attacks: [{ name: 'Brave Blade', cost: ['Metal', 'Metal', 'Metal', 'Colorless'], damage: '230', text: "During your next turn, this Pokémon can't attack." }],
  },
  {
    id: 'base1-6',
    name: 'Gyarados',
    supertype: 'Pokémon',
    subtypes: ['Stage 1'],
    hp: '100',
    types: ['Water'],
    rarity: 'Rare Holo',
    set: { name: 'Base Set', series: 'Base' },
    number: '6',
    images: { large: 'https://images.pokemontcg.io/base1/6_hires.png', small: 'https://images.pokemontcg.io/base1/6.png' },
    attacks: [{ name: 'Dragon Rage', cost: ['Water', 'Water', 'Water'], damage: '50', text: '' }],
  },
  {
    id: 'base1-10',
    name: 'Mewtwo',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '60',
    types: ['Psychic'],
    rarity: 'Rare Holo',
    set: { name: 'Base Set', series: 'Base' },
    number: '10',
    images: { large: 'https://images.pokemontcg.io/base1/10_hires.png', small: 'https://images.pokemontcg.io/base1/10.png' },
    attacks: [{ name: 'Psychic', cost: ['Psychic', 'Psychic', 'Psychic'], damage: '10+', text: 'Does 10 damage plus 10 more damage for each Energy card attached to the Defending Pokémon.' }],
  },
];

let allCards = [];
let filteredCards = [];

const elements = {
  grid: document.getElementById('cards-grid'),
  loading: document.getElementById('loading'),
  empty: document.getElementById('empty-state'),
  search: document.getElementById('search'),
  typeFilter: document.getElementById('type-filter'),
  rarityFilter: document.getElementById('rarity-filter'),
  cardCount: document.getElementById('card-count'),
  modal: document.getElementById('modal'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
  modalBackdrop: document.getElementById('modal-backdrop'),
};

async function fetchCards() {
  try {
    const response = await fetch(
      'https://api.pokemontcg.io/v2/cards?pageSize=24&orderBy=-set.releaseDate',
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    return data.data?.length ? data.data : FALLBACK_CARDS;
  } catch {
    return FALLBACK_CARDS;
  }
}

function getPrimaryType(card) {
  return card.types?.[0] || '';
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function filterCards() {
  const query = elements.search.value.trim().toLowerCase();
  const type = elements.typeFilter.value;
  const rarity = elements.rarityFilter.value;

  filteredCards = allCards.filter((card) => {
    const matchesSearch = !query || card.name.toLowerCase().includes(query);
    const matchesType = !type || card.types?.includes(type);
    const matchesRarity = !rarity || card.rarity === rarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  renderCards();
}

function renderCards() {
  elements.cardCount.textContent = filteredCards.length;
  elements.grid.innerHTML = '';

  if (filteredCards.length === 0) {
    elements.empty.classList.remove('hidden');
    return;
  }

  elements.empty.classList.add('hidden');

  filteredCards.forEach((card, index) => {
    const type = getPrimaryType(card);
    const el = document.createElement('article');
    el.className = 'card-item';
    el.style.animationDelay = `${index * 0.04}s`;
    el.innerHTML = `
      <div class="card-item__image-wrap">
        <img src="${card.images.small}" alt="${card.name}" loading="lazy">
        ${type ? `<span class="card-item__type-badge type-${type}">${typeLabel(type)}</span>` : ''}
      </div>
      <div class="card-item__info">
        <h3 class="card-item__name">${card.name}</h3>
        <div class="card-item__meta">
          ${card.hp ? `<span class="card-item__hp">${card.hp} HP</span>` : '<span></span>'}
          ${card.rarity ? `<span class="card-item__rarity">${card.rarity}</span>` : ''}
        </div>
      </div>
    `;
    el.addEventListener('click', () => openModal(card));
    elements.grid.appendChild(el);
  });
}

function openModal(card) {
  const type = getPrimaryType(card);
  const attacksHtml = (card.attacks || [])
    .map(
      (atk) => `
      <div class="modal__attack">
        <div class="modal__attack-name">
          ${atk.name}
          ${atk.damage ? `<span class="modal__attack-damage"> — ${atk.damage}</span>` : ''}
        </div>
        ${atk.text ? `<p class="modal__attack-text">${atk.text}</p>` : ''}
      </div>
    `
    )
    .join('');

  elements.modalBody.innerHTML = `
    <img class="modal__card-image" src="${card.images.large}" alt="${card.name}">
    <h2 class="modal__title">${card.name}</h2>
    <p class="modal__set">${card.set?.name || ''} · #${card.number || '?'}</p>
    <div class="modal__details">
      <div class="modal__detail">
        <div class="modal__detail-label">Tipo</div>
        <div class="modal__detail-value">${card.types?.map(typeLabel).join(', ') || '—'}</div>
      </div>
      <div class="modal__detail">
        <div class="modal__detail-label">HP</div>
        <div class="modal__detail-value">${card.hp || '—'}</div>
      </div>
      <div class="modal__detail">
        <div class="modal__detail-label">Rareza</div>
        <div class="modal__detail-value">${card.rarity || '—'}</div>
      </div>
      <div class="modal__detail">
        <div class="modal__detail-label">Etapa</div>
        <div class="modal__detail-value">${card.subtypes?.join(', ') || '—'}</div>
      </div>
      ${attacksHtml ? `<div class="modal__attacks"><div class="modal__detail-label">Ataques</div>${attacksHtml}</div>` : ''}
    </div>
  `;

  elements.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  elements.modal.classList.add('hidden');
  document.body.style.overflow = '';
}

async function init() {
  allCards = await fetchCards();
  elements.loading.classList.add('hidden');
  filteredCards = allCards;
  renderCards();

  elements.search.addEventListener('input', filterCards);
  elements.typeFilter.addEventListener('change', filterCards);
  elements.rarityFilter.addEventListener('change', filterCards);
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

init();
