"""
Component System - Definizione e gestione di componenti parametrici
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import json
import numpy as np
from pathlib import Path

@dataclass
class ComponentDefinition:
    """Definizione parametrica di un componente salvato nella libreria"""
    id: int
    name: str
    type: str                    # "wheel", "tube", "seat", "handlebar", "custom"
    category: str                # "wheels", "frame", "interior", "body"
    
    # Parametri modificabili (es. radius, width, length)
    parameters: Dict[str, float] = field(default_factory=dict)
    
    # Geometria di default (voxel positions relative)
    default_voxels: List[Dict] = field(default_factory=list)
    
    # Icona e preview
    icon: str = "🔧"
    color: str = "#888888"
    description: str = ""

@dataclass
class ComponentInstance:
    """Istanza di un componente posizionato nel progetto"""
    id: int
    definition_id: int
    name: str
    
    position: np.ndarray         # Posizione nel mondo (mm)
    rotation: np.ndarray = field(default_factory=lambda: np.array([0., 0., 0.]))
    
    # Override parametri specifici per questa istanza
    parameter_overrides: Dict[str, float] = field(default_factory=dict)
    
    # Materiale override (opzionale)
    material_override: Optional[str] = None
    
    # Metadata
    created_by: str = "user"

class ComponentLibrary:
    """Gestore della libreria di componenti"""
    
    def __init__(self, data_dir: str = "data/components"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.definitions: Dict[int, ComponentDefinition] = {}
        self._load_defaults()
    
    def _load_defaults(self):
        """Carica i componenti predefiniti di base"""
        # Road Wheel 700c (30mm pneumatico, 622mm cerchio)
        self.definitions[1] = ComponentDefinition(
            id=1,
            name="Ruota Strada 700c",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#333",
            description="Ruota strada 700c con pneumatico da 30mm",
            parameters={
                "outer_radius": 350,     # mm (700/2 + 30mm gomma)
                "inner_radius": 311,     # mm (622mm cerchio ISO)
                "width": 30,             # mm pneumatico
                "rim_width": 21,         # mm cerchio
                "spoke_count": 32
            }
        )
        
        # Mountain Wheel 29"
        self.definitions[2] = ComponentDefinition(
            id=2,
            name="Ruota MTB 29\"",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#555",
            description="Ruota MTB 29\" con pneumatico da 2.35\"",
            parameters={
                "outer_radius": 380,     # mm
                "inner_radius": 305,     # mm
                "width": 60,             # mm pneumatico 2.35"
                "rim_width": 30,
                "spoke_count": 32
            }
        )
        
        # BMX Wheel 20"
        self.definitions[3] = ComponentDefinition(
            id=3,
            name="Ruota BMX 20\"",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#444",
            description="Ruota BMX 20\"",
            parameters={
                "outer_radius": 305,
                "inner_radius": 254,
                "width": 50,
                "rim_width": 25,
                "spoke_count": 36
            }
        )
        
        # Top Tube (telaio bici)
        self.definitions[10] = ComponentDefinition(
            id=10,
            name="Top Tube",
            type="tube",
            category="frame",
            icon="📏",
            color="#aaa",
            description="Tubo orizzontale telaio bici",
            parameters={
                "length": 500,          # mm
                "diameter": 28.6,       # mm (1.125" standard)
                "wall_thickness": 1.5   # mm
            }
        )
        
        # Down Tube
        self.definitions[11] = ComponentDefinition(
            id=11,
            name="Down Tube",
            type="tube",
            category="frame",
            icon="📏",
            color="#bbb",
            description="Tubo inclinato telaio bici",
            parameters={
                "length": 420,
                "diameter": 31.8,       # mm (1.25")
                "wall_thickness": 1.5
            }
        )
        
        # Seat Tube
        self.definitions[12] = ComponentDefinition(
            id=12,
            name="Seat Tube",
            type="tube",
            category="frame",
            icon="📏",
            color="#ccc",
            description="Tubo reggisella",
            parameters={
                "length": 450,
                "diameter": 31.6,       # mm (1.24")
                "wall_thickness": 1.5
            }
        )
        
        # Seatpost
        self.definitions[13] = ComponentDefinition(
            id=13,
            name="Seatpost",
            type="seatpost",
            category="interior",
            icon="🪑",
            color="#999",
            description="Reggisella bici",
            parameters={
                "length": 400,
                "diameter": 27.2,       # mm
                "offset": 18            # mm di offset
            }
        )
        
        # Saddle
        self.definitions[14] = ComponentDefinition(
            id=14,
            name="Sella",
            type="saddle",
            category="interior",
            icon="🪑",
            color="#654",
            description="Sella bici",
            parameters={
                "length": 300,
                "width": 150,
                "height": 40
            }
        )
        
        # Handlebar
        self.definitions[20] = ComponentDefinition(
            id=20,
            name="Manubrio",
            type="handlebar",
            category="interior",
            icon="🎯",
            color="#888",
            description="Manubrio bici",
            parameters={
                "width": 580,
                "drop": 120,
                "diameter": 25.4         # mm (strada) o 31.8 (mtb)
            }
        )
        
        # Stem
        self.definitions[21] = ComponentDefinition(
            id=21,
            name="Attacco Manubrio",
            type="stem",
            category="interior",
            icon="🔗",
            color="#777",
            description="Attacco manubrio",
            parameters={
                "length": 70,            # mm reach
                "angle": 6,              # gradi
                "diameter": 31.8
            }
        )
        
        # Fork
        self.definitions[22] = ComponentDefinition(
            id=22,
            name="Forcella",
            type="fork",
            category="frame",
            icon="🔱",
            color="#666",
            description="Forcella anteriore bici",
            parameters={
                "length": 380,
                "offset": 45,            # mm offset dalla testa forcella
                "crown_diameter": 40,
                "blade_width": 30
            }
        )
        
        print(f"[ComponentLibrary] Loaded {len(self.definitions)} default components")
    
    def get(self, comp_id: int) -> Optional[ComponentDefinition]:
        return self.definitions.get(comp_id)
    
    def get_all(self) -> List[ComponentDefinition]:
        return list(self.definitions.values())
    
    def get_by_category(self, category: str) -> List[ComponentDefinition]:
        return [c for c in self.definitions.values() if c.category == category]
    
    def get_by_type(self, type_: str) -> List[ComponentDefinition]:
        return [c for c in self.definitions.values() if c.type == type_]
    
    def save_custom(self, definition: ComponentDefinition) -> bool:
        """Salva un componente definito dall'utente nel JSON"""
        filepath = self.data_dir / f"component_{definition.id}.json"
        try:
            with open(filepath, 'w') as f:
                json.dump(self._definition_to_dict(definition), f, indent=2)
            self.definitions[definition.id] = definition
            return True
        except Exception as e:
            print(f"Error saving component: {e}")
            return False
    
    def load_custom(self, filepath: str) -> Optional[ComponentDefinition]:
        """Carica un componente da file JSON"""
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            return self._dict_to_definition(data)
        except Exception as e:
            print(f"Error loading component: {e}")
            return None
    
    def _definition_to_dict(self, def_: ComponentDefinition) -> dict:
        return {
            "id": def_.id,
            "name": def_.name,
            "type": def_.type,
            "category": def_.category,
            "parameters": def_.parameters,
            "default_voxels": def_.default_voxels,
            "icon": def_.icon,
            "color": def_.color,
            "description": def_.description
        }
    
    def _dict_to_definition(self, data: dict) -> ComponentDefinition:
        return ComponentDefinition(**data)
    
    def search(self, query: str) -> List[ComponentDefinition]:
        """Ricerca componenti per nome o descrizione"""
        q = query.lower()
        return [c for c in self.definitions.values() 
                if q in c.name.lower() or q in c.description.lower()]


# Helper per creare istanze
def create_component_instance(definition: ComponentDefinition, 
                              position_mm: List[float],
                              parameter_overrides: Dict[str, float] = None,
                              material_override: str = None) -> ComponentInstance:
    """Crea un'istanza posizionata di un componente"""
    return ComponentInstance(
        id=0,  # Assegnato dal gestore
        definition_id=definition.id,
        name=f"{definition.name} @ {position_mm}",
        position=np.array(position_mm, dtype=float),
        parameter_overrides=parameter_overrides or {},
        material_override=material_override
    )


if __name__ == "__main__":
    library = ComponentLibrary()
    
    # Test ricerca
    wheels = library.get_by_category("wheels")
    print(f"\nRuote trovate: {len(wheels)}")
    for w in wheels:
        print(f"  [{w.id}] {w.name} - Raggio: {w.parameters.get('outer_radius', 'N/A')}mm")