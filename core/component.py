"""
Component System - Definition and management of parametric components
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import json
import numpy as np
from pathlib import Path

@dataclass
class ComponentDefinition:
    """Parametric definition of a component saved in the library"""
    id: int
    name: str
    type: str                    # "wheel", "tube", "seat", "handlebar", "custom"
    category: str                # "wheels", "frame", "interior", "body"
    
    # Modifiable parameters (e.g. radius, width, length)
    parameters: Dict[str, float] = field(default_factory=dict)
    
    # Default geometry (voxel positions relative)
    default_voxels: List[Dict] = field(default_factory=list)
    
    # Icon and preview
    icon: str = "🔧"
    color: str = "#888888"
    description: str = ""

@dataclass
class ComponentInstance:
    """Instance of a component positioned in the project"""
    id: int
    definition_id: int
    name: str
    
    position: np.ndarray         # Position in the world (mm)
    rotation: np.ndarray = field(default_factory=lambda: np.array([0., 0., 0.]))
    
    # Override specific parameters for this instance
    parameter_overrides: Dict[str, float] = field(default_factory=dict)
    
    # Override material (optional)
    material_override: Optional[str] = None
    
    # Metadata
    created_by: str = "user"

class ComponentLibrary:
    """Manager of the component library"""
    
    def __init__(self, data_dir: str = "data/components"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.definitions: Dict[int, ComponentDefinition] = {}
        self._load_defaults()
    
    def _load_defaults(self):
        """Load the default base components"""
        # Road Wheel 700c (30mm tire, 622mm rim)
        self.definitions[1] = ComponentDefinition(
            id=1,
            name="Road Wheel 700c",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#333",
            description="700c road wheel with 30mm tire",
            parameters={
                "outer_radius": 350,     # mm (700/2 + 30mm tire)
                "inner_radius": 311,     # mm (622mm ISO rim)
                "width": 30,             # mm tire
                "rim_width": 21,         # mm rim
                "spoke_count": 32
            }
        )
        
        # Mountain Wheel 29"
        self.definitions[2] = ComponentDefinition(
            id=2,
            name="Mountain Bike Wheel 29\"",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#555",
            description="29\" mountain bike tire with 2.35\" tire",
            parameters={
                "outer_radius": 380,     # mm
                "inner_radius": 305,     # mm
                "width": 60,             # mm tire 2.35\"
                "rim_width": 30,
                "spoke_count": 32
            }
        )
        
        # BMX Wheel 20"
        self.definitions[3] = ComponentDefinition(
            id=3,
            name="BMX Wheel 20\"",
            type="wheel",
            category="wheels",
            icon="⚫",
            color="#444",
            description="BMX 20\" wheel",
            parameters={
                "outer_radius": 305,
                "inner_radius": 254,
                "width": 50,
                "rim_width": 25,
                "spoke_count": 36
            }
        )
        
        # Top Tube (bike frame)
        self.definitions[10] = ComponentDefinition(
            id=10,
            name="Top Tube",
            type="tube",
            category="frame",
            icon="📏",
            color="#aaa",
            description="Horizontal bike frame tube",
            parameters={
                "length": 500,          # mm
                "diameter": 28.6,       # mm (1.125\" standard)
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
            description="Slanted bike frame tube",
            parameters={
                "length": 420,
                "diameter": 31.8,       # mm (1.25\")
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
            description="Seatpost tube",
            parameters={
                "length": 450,
                "diameter": 31.6,       # mm (1.24\")
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
            description="Bike seatpost",
            parameters={
                "length": 400,
                "diameter": 27.2,       # mm
                "offset": 18            # mm offset
            }
        )
        
        # Saddle
        self.definitions[14] = ComponentDefinition(
            id=14,
            name="Saddle",
            type="saddle",
            category="interior",
            icon="🪑",
            color="#654",
            description="Bike saddle",
            parameters={
                "length": 300,
                "width": 150,
                "height": 40
            }
        )
        
        # Handlebar
        self.definitions[20] = ComponentDefinition(
            id=20,
            name="Handlebar",
            type="handlebar",
            category="interior",
            icon="🎯",
            color="#888",
            description="Bike handlebar",
            parameters={
                "width": 580,
                "drop": 120,
                "diameter": 25.4         # mm (road) or 31.8 (mtb)
            }
        )
        
        # Stem
        self.definitions[21] = ComponentDefinition(
            id=21,
            name="Stem",
            type="stem",
            category="interior",
            icon="🔗",
            color="#777",
            description="Handlebar stem",
            parameters={
                "length": 70,            # mm reach
                "angle": 6,              # degrees
                "diameter": 31.8
            }
        )
        
        # Fork
        self.definitions[22] = ComponentDefinition(
            id=22,
            name="Fork",
            type="fork",
            category="frame",
            icon="🔱",
            color="#666",
            description="Front bike fork",
            parameters={
                "length": 380,
                "offset": 45,            # mm offset from fork head
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
        """Save a user-defined component to JSON"""
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
        """Load a component from JSON file"""
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
        """Search components by name or description"""
        q = query.lower()
        return [c for c in self.definitions.values() 
                if q in c.name.lower() or q in c.description.lower()]


# Helper to create instances
def create_component_instance(definition: ComponentDefinition, 
                              position_mm: List[float],
                              parameter_overrides: Dict[str, float] = None,
                              material_override: str = None) -> ComponentInstance:
    """Create a positioned instance of a component"""
    return ComponentInstance(
        id=0,  # Assigned by the manager
        definition_id=definition.id,
        name=f"{definition.name} @ {position_mm}",
        position=np.array(position_mm, dtype=float),
        parameter_overrides=parameter_overrides or {},
        material_override=material_override
    )


if __name__ == "__main__":
    library = ComponentLibrary()
    
    # Test search
    wheels = library.get_by_category("wheels")
    print(f"\nFound wheels: {len(wheels)}")
    for w in wheels:
        print(f"  [{w.id}] {w.name} - Radius: {w.parameters.get('outer_radius', 'N/A')}mm")