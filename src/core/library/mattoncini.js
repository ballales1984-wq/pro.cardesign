/**
 * Mattoncini Library - Componenti per costruzioni base e LEGO-style
 */

/**
 * Carica tutti i componenti di tipo mattoncino
 * @returns {Array} Array di definizioni di componenti mattoncini
 */
export function loadMattonciniComponents() {
  const components = [];

  // 2x4 Brick (LEGO style)
  components.push({
    id: 100,
    name: 'Mattoncino 2x4',
    type: 'brick',
    category: 'mattoncini',
    icon: '',
    color: '#ff0000',
    description: 'Mattoncino LEGO stile 2x4',
    parameters: {
      width: { value: 8, min: 4, max: 16, unit: 'mm' },
      height: { value: 9.6, min: 4, max: 20, unit: 'mm' },
      depth: { value: 16, min: 4, max: 32, unit: 'mm' }
    }
  });

  // Blocco 40x70 (comune in edilizia)
  components.push({
    id: 101,
    name: 'Blocco 40x70',
    type: 'brick',
    category: 'mattoncini',
    icon: '',
    color: '#8B4513',
    description: 'Blocco rettangolare 40x70 mm con spessore standard',
    parameters: {
      width: { value: 40, min: 20, max: 100, unit: 'mm' },
      height: { value: 70, min: 20, max: 150, unit: 'mm' },
      depth: { value: 200, min: 50, max: 300, unit: 'mm' }
    }
  });

  // Blocco 50x50 (quadrato comune)
  components.push({
    id: 102,
    name: 'Blocco 50x50',
    type: 'brick',
    category: 'mattoncini',
    icon: '',
    color: '#A0522D',
    description: 'Blocco quadrato 50x50 mm con spessore standard',
    parameters: {
      width: { value: 50, min: 20, max: 100, unit: 'mm' },
      height: { value: 50, min: 20, max: 100, unit: 'mm' },
      depth: { value: 200, min: 50, max: 300, unit: 'mm' }
    }
  });

  return components;
}