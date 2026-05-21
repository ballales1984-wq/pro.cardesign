/**
 * Cantiere Library - Componenti per elementi strutturali di costruzione
 */

/**
 * Carica tutti i componenti di tipo cantiere (strutturali)
 * @returns {Array} Array di definizioni di componenti cantiere
 */
export function loadCantiereComponents() {
  const components = [];

  // Blocco 1000x1000 (1m x 1m - lastre/pannelli)
  components.push({
    id: 103,
    name: 'Blocco 1000x1000',
    type: 'brick',
    category: 'cantiere',
    icon: '',
    color: '#696969',
    description: 'Blocco grande 1000x1000 mm per lastre e pannelli',
    parameters: {
      width: { value: 1000, min: 100, max: 2000, unit: 'mm' },
      height: { value: 1000, min: 100, max: 2000, unit: 'mm' },
      depth: { value: 200, min: 50, max: 500, unit: 'mm' }
    }
  });

  // Blocco 200x200 (blocco di cemento standard)
  components.push({
    id: 104,
    name: 'Blocco 200x200',
    type: 'brick',
    category: 'cantiere',
    icon: '',
    color: '#808080',
    description: 'Blocco di cemento standard 200x200 mm',
    parameters: {
      width: { value: 200, min: 100, max: 300, unit: 'mm' },
      height: { value: 200, min: 100, max: 300, unit: 'mm' },
      depth: { value: 200, min: 100, max: 300, unit: 'mm' }
    }
  });

  // Trave 40x60 (trave in legno/acciaio comune)
  components.push({
    id: 107,
    name: 'Trave 40x60',
    type: 'brick',
    category: 'cantiere',
    icon: '',
    color: '#8B4513',
    description: 'Trave rettangolare 40x60 mm per strutture',
    parameters: {
      width: { value: 40, min: 20, max: 100, unit: 'mm' },
      height: { value: 60, min: 30, max: 150, unit: 'mm' },
      depth: { value: 2000, min: 500, max: 6000, unit: 'mm' }
    }
  });

  // Trave 60x80 (trave strutturale più grande)
  components.push({
    id: 108,
    name: 'Trave 60x80',
    type: 'brick',
    category: 'cantiere',
    icon: '',
    color: '#654321',
    description: 'Trave rettangolare 60x80 mm per strutture portanti',
    parameters: {
      width: { value: 60, min: 30, max: 120, unit: 'mm' },
      height: { value: 80, min: 40, max: 200, unit: 'mm' },
      depth: { value: 3000, min: 1000, max: 6000, unit: 'mm' }
    }
  });

  // Pilastro 200x200 (pilastro in cemento armato)
  components.push({
    id: 109,
    name: 'Pilastro 200x200',
    type: 'brick',
    category: 'cantiere',
    icon: '',
    color: '#2F4F4F',
    description: 'Pilastro quadrato 200x200 mm per strutture',
    parameters: {
      width: { value: 200, min: 100, max: 400, unit: 'mm' },
      height: { value: 200, min: 100, max: 400, unit: 'mm' },
      depth: { value: 3000, min: 1000, max: 6000, unit: 'mm' }
    }
  });

  return components;
}