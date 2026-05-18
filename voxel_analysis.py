#!/usr/bin/env python3

def find_matching_brace(lines, start_line):
    """Find the matching closing brace for a class starting at start_line (1-indexed)"""
    brace_count = 0
    found_open = False
    
    for i in range(start_line - 1, len(lines)):  # Convert to 0-indexed
        line = lines[i]
        for char in line:
            if char == '{':
                brace_count += 1
                found_open = True
            elif char == '}':
                brace_count -= 1
                
        # If we found the opening brace and now brace_count is 0, we found the match
        if found_open and brace_count == 0:
            return i + 1  # Return 1-indexed line number
    
    return None  # Not found

def extract_methods(lines, start_line, end_line):
    """Extract method definitions from lines[start_line-1:end_line] (1-indexed inclusive)"""
    methods = []
    
    for i in range(start_line - 1, end_line):  # 0-indexed, up to but not including closing brace
        line_num = i + 1
        line = lines[i]
        
        # Look for method definitions: indentation + method name + parameters + {
        # Match patterns like "    methodName(params) {" or "        methodName(params) {"
        match = re.match(r'^(\s*)([_a-zA-Z][\w]*)\s*\([^)]*\)\s*\{', line)
        if match:
            indent = len(match.group(1))
            name = match.group(2)
            methods.append({
                'line': line_num,
                'name': name,
                'indent': indent,
                'raw': line.rstrip()
            })
    
    return methods

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
        return None
    
    # Find matching closing brace
    class_end_line = find_matching_brace(lines, class_start_line)
    if class_end_line is None:
        print("ERROR: Could not find matching closing brace")
        return None
        
    print(f"Matching closing }} found at line: {class_end_line}")
    
    # Extract methods from class body
    methods = extract_methods(lines, class_start_line, class_end_line)
    print(f"Found {len(methods)} methods in class:")
    
    # Group methods by indentation to see which are likely class methods
    indent_groups = {}
    for method in methods:
        indent = method['indent']
        if indent not in indent_groups:
            indent_groups[indent] = []
        indent_groups[indent].append(method)
    
    print("\nMethods by indentation level:")
    for indent in sorted(indent_groups.keys()):
        print(f"  Indent {indent}:")
        for method in indent_groups[indent]:
            print(f"    Line {method['line']:3}: {method['name']}")
    
    # Likely class methods are those with indentation of 4 or 8 spaces (based on looking at the code)
    likely_class_methods = [m for m in methods if m['indent'] in [4, 8]]
    print(f"\nLikely class methods (indent 4 or 8): {len(likely_class_methods)}")
    for method in sorted(likely_class_methods, key=lambda x: x['line']):
        print(f"  Line {method['line']:3}: {method['name']}")
    
    return {
        'class_start': class_start_line,
        'class_end': class_end_line,
        'methods': methods,
        'likely_class_methods': likely_class_methods
    }

def get_method_names(methods):
    return [m['name'] for m in methods]

if __name__ == "__main__":
    current_file = "D:\\pro.cardesign\\src\\voxel-engine.js"
    old_file = "D:\\pro.cardesign\\ve-old-tmp.js"
    
    print("VOXEL ENGINE FILE ANALYSIS")
    print("=" * 50)
    print()
    
    current = analyze_file(current_file)
    print()
    old = analyze_file(old_file)
    
    if current and old:
        print()
        print("=== COMPARISON RESULTS ===")
        print()
        
        current_methods = set(get_method_names(current['likely_class_methods']))
        old_methods = set(get_method_names(old['likely_class_methods']))
        
        print(f"Current file has {len(current_methods)} likely class methods")
        print(f"Old file has {len(old_methods)} likely class methods")
        print()
        
        only_in_current = current_methods - old_methods
        only_in_old = old_methods - current_methods
        in_both = current_methods & old_methods
        
        print(f"Methods only in current file: {len(only_in_current)}")
        if only_in_current:
            for method in sorted(only_in_current):
                print(f"  + {method}")
        print()
        
        print(f"Methods only in old file: {len(only_in_old)}")
        if only_in_old:
            for method in sorted(only_in_old):
                print(f"  - {method}")
        print()
        
        print(f"Methods in both files: {len(in_both)}")
        # Don't print all common methods unless requested
        
        # Check critical methods
        print()
        print("=== CRITICAL METHOD PRESENCE CHECK ===")
        critical_methods = [
            'addVoxel', '_addVoxelInternal', 'fillLayer', 'removeVoxel',
            '_onPointerMove', '_onPointerClick', '_onKeyDown',
            '_createGhost', '_createHighlight', '_setupEvents', '_setupScalePanelListeners'
        ]
        
        for method in critical_methods:
            in_current = method in current_methods
            in_old = method in old_methods
            
            status_parts = []
            if in_current:
                status_parts.append("CURRENT: ✓")
            else:
                status_parts.append("CURRENT: ✗")
                
            if in_old:
                status_parts.append("OLD: ✓")
            else:
                status_parts.append("OLD: ✗")
                
            print(f"{method:25} {' '.join(status_parts)}")