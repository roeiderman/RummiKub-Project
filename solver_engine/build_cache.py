# build_cache.py
import json
import itertools

COLORS = ['Red', 'Blue', 'Black', 'Yellow']
NUMBERS = list(range(1, 14)) 

def generate_base_combinations():
    base_combos = []
    for num in NUMBERS:
        for colors_subset in itertools.combinations(COLORS, 3):
            base_combos.append([f"{color}_{num}" for color in colors_subset])
        base_combos.append([f"{color}_{num}" for color in COLORS])
            
    for color in COLORS:
        for length in range(3, 14): 
            for start in range(1, 14 - length + 1):
                run = [f"{color}_{start + i}" for i in range(length)]
                base_combos.append(run)
    return base_combos

def add_jokers_and_deduplicate(base_combos):
    all_combos_with_jokers = set()
    
    for combo in base_combos:
        length = len(combo)
        
        # 0 Jokers (The base combination itself)
        all_combos_with_jokers.add(tuple(sorted(combo)))
        
        # 1 Joker: Replace 1 tile
        for i in range(length):
            temp_combo = combo.copy()
            temp_combo[i] = 'Black_Joker'
            all_combos_with_jokers.add(tuple(sorted(temp_combo)))
            
        for i in range(length):
            temp_combo = combo.copy()
            temp_combo[i] = 'Red_Joker'
            all_combos_with_jokers.add(tuple(sorted(temp_combo)))
            
        # 2 Jokers: Replace 2 tiles (if the game has 2 jokers)
        for i, j in itertools.permutations(range(length), 2):
            temp_combo = combo.copy()
            temp_combo[i] = 'Red_Joker'
            temp_combo[j] = 'Black_Joker'
            all_combos_with_jokers.add(tuple(sorted(temp_combo)))
            
    # Convert tuples back to lists for easier handling later
    return [list(c) for c in all_combos_with_jokers]

print("Building dictionary...")
base_combos = generate_base_combinations()
all_combos = add_jokers_and_deduplicate(base_combos)

with open("valid_combinations.json", "w") as file:
    json.dump(all_combos, file)
    
print("Success! valid_combinations.json created.")