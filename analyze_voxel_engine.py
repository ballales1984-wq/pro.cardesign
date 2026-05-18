#!/usr/bin/env python3

import re
import sys

def analyze_file(filepath):
    print(f"=== Analyzing {filepath} ===")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Find class start
    class_start_line = None
    for i, line in enumerate(lines):
        if re.match(r'^\s*export\s+class\s+VoxelEngine\s*\{', line):
            class_start_line = i + 1  # 1-indexed
            print(f"export class VoxelEngine found at line: {class_start_line}")
            break
    
    if class_start_line is None:
        print("ERROR: Could not find export class VoxelEngine")
        return
    
    # Find matching closing brace by counting braces
    brace_count = 0
    class_end_line = None
    for i in range(class_start_line - 1, len(lines)):  # Start from class start line (0-indexed)
        line = lines[i]
        # Count opening and closing braces in this line
        brace_count += line.count('{')
        brace_count -= line.count('}')
        
        if brace_count == 0 and i >= class_start_line - 1:
            class_end_line = i + 1  # 1-indexed
            print(f"Matching closing }} found at line: {class_end_line}")
            break
    
    if class_end_line is None:
        print("ERROR: Could not find matching closing brace")
        return
    
    # Extract methods from class body (between class_start_line and class_end_line)
    methods = []
    in_method = False
    method_start_line = None
    method_name = None
    method_indent = None
    
    for i in range(class_start_line - 1, class_end_line):  # 0-indexed, up to but not including closing brace
        line_num = i + 1
        line = lines[i]
        
        # Skip empty lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith('//') or stripped.startswith('*'):
            continue
            
        # Check for method definition pattern: spaces + method name + parameters + {
        # Looking for lines that start with spaces, then a word, then parentheses, then {
        method_match = re.match(r'^(\s*)([_a-zA-Z][\w]*)\s*\([^)]*\)\s*\{', line)
        if method_match:
            # This is a method definition
            indent = len(method_match.group(1))
            name = method_match.group(2)
            
            # Only consider methods that are direct members of the class (indentation level 4 spaces)
            # Based on the code appearance, methods seem to be indented with 8 spaces (2 tabs or 8 spaces)
            # But let's check for reasonable indentation
            if indent >= 4:  # At least 4 spaces indented
                methods.append({
                    'line': line_num,
                    'name': name,
                    'indent': indent,
                    'raw_line': line.rstrip()
                })
                print(f"  Method '{name}' at line {line_num} (indent: {indent})")
    
    print(f"Total methods found: {len(methods)}")
    print()
    
    return {
        'class_start': class_start_line,
        'class_end': class_end_line,
        'methods': methods
    }

def get_method_names(methods):
    return [m['name'] for m in methods]

if __name__ == "__main__":
    current_file = "D:\\pro.cardesign\\src\\voxel-engine.js"
    old_file = "D:\\pro.cardesign\\ve-old-tmp.js"
    
    current = analyze_file(current_file)
    old = analyze_file(old_file)
    
    if current and old:
        current_methods = set(get_method_names(current['methods']))
        old_methods = set(get_method_names(old['methods']))
        
        print("=== COMPARISON ===")
        print(f"Methods in current but not in old: {current_methods - old_methods}")
        print(f"Methods in old but not in current: {old_methods - current_methods}")
        print()
        
        # Check for critical methods
        critical_methods = [
            'addVoxel', '_addVoxelInternal', 'fillLayer', 'removeVoxel',
            '_onPointerMove', '_onPointerClick', '_onKeyDown',
            '_createGhost', '_createHighlight', '_setupEvents', '_setupScalePanelListeners'
        ]
        
        print("=== CRITICAL METHOD CHECK ===")
        for method in critical_methods:
            in_current = method in current_methods
            in_old = method in old_methods
            status = []
            if in_current:
                status.append("CURRENT:YES")
            else:
                status.append("CURRENT:NO")
            if in_old:
                status.append("OLD:YES")
            else:
                status.append("OLD:NO")
            print(f"{method}: {', '.join(status)}")