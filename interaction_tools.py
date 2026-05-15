import numpy as np
from voxel_editor import Brick

class InteractionManager:
    def __init__(self, brick_engine):
        self.engine = brick_engine
        self.selected_brick = None
        self.resize_axis = None  # 'x', 'y', 'z'
        self.start_size = None
        self.start_mouse = None
    
    def select_brick(self, brick: Brick):
        self.selected_brick = brick
        self.resize_axis = None
    
    def start_resize(self, brick: Brick, axis: str, mouse_x: float):
        self.selected_brick = brick
        self.resize_axis = axis
        self.start_size = getattr(brick, f'width' if axis == 'x' else f'height' if axis == 'y' else 'depth')
        self.start_mouse = mouse_x
    
    def update_resize(self, mouse_x: float, scale_factor: float = 10.0):
        if not self.selected_brick or not self.resize_axis:
            return
        
        delta = (mouse_x - self.start_mouse) * scale_factor
        new_size = max(1.0, self.start_size + delta)
        
        attr = 'width' if self.resize_axis == 'x' else 'height' if self.resize_axis == 'y' else 'depth'
        setattr(self.selected_brick, attr, new_size)
        
        return new_size
    
    def stop_resize(self):
        self.resize_axis = None
        self.start_size = None
        self.start_mouse = None
    
    def duplicate_brick(self, original: Brick, offset: tuple = (0, 0, 0)):
        new_brick = Brick(
            x=original.x + offset[0],
            y=original.y + offset[1],
            z=original.z + offset[2],
            width=original.width,
            height=original.height,
            depth=original.depth,
            material=original.material,
            density=original.density,
            temperature_limit=original.temperature_limit,
            module=original.module,
            color=original.color
        )
        self.engine.bricks.append(new_brick)
        return new_brick
    
    def get_brick_at_position(self, x: float, y: float, z: float) -> Brick:
        for brick in self.engine.bricks:
            if (brick.x <= x <= brick.x + brick.width and
                brick.y <= y <= brick.y + brick.height and
                brick.z <= z <= brick.z + brick.depth):
                return brick
        return None