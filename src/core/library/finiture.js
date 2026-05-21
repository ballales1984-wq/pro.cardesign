/**
 * Finiture Library - Componenti per finiture edilizie e rivestimenti
 */

/**
 * Carica tutti i componenti di tipo finitura
 * @returns {Array} Array di definizioni di componenti finitura
 */
export function loadFinitureComponents() {
  const components = [];

  // Blocco 100x200 (mezzo blocco standard)
  components.push({
    id: 105,
    name: 'Blocco 100x200',
    type: 'brick',
    category: 'finiture',
    icon: '',
    color: '#A9A9A9',
    description: 'Mezzo blocco di cemento 100x200 mm',
    parameters: {
      width: { value: 100, min: 50, max: 150, unit: 'mm' },
      height: { value: 200, min: 100, max: 300, unit: 'mm' },
      depth: { value: 200, min: 100, max: 300, unit: 'mm' }
    }
  });

  // Lastra 1200x2400 (lastra di cartongesso standard)
  components.push({
    id: 106,
    name: 'Lastra 1200x2400',
    type: 'brick',
    category: 'finiture',
    icon: '',
    color: '#FFFFFF',
    description: 'Lastra di cartongesso standard 1200x2400 mm',
    parameters: {
      width: { value: 1200, min: 600, max: 1800, unit: 'mm' },
      height: { value: 2400, min: 1200, max: 3000, unit: 'mm' },
      depth: { value: 12, min: 6, max: 25, unit: 'mm' }
    }
  });

  return components;
}