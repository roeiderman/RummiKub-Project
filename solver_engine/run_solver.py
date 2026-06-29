import sys
import json
import pulp
import os

# Builds and solves the ILP model: assigns all ~2500 valid combinations to tiles,
# minimizing unused rack tiles (×1) and unused board tiles (×10000).
# At least one rack tile must be placed. Returns which combinations to use.
def solve_rummikub_turn(board_pool, rack_pool, valid_combinations):

    # Build the universe of all tile types across combinations, board and rack
    all_tile_types = set()
    for combo in valid_combinations:
        for tile in combo:
            all_tile_types.add(tile)
    all_tile_types = all_tile_types.union(set(board_pool.keys())).union(set(rack_pool.keys()))

    # Merge board and rack into one pool: total count of each tile type available
    total_pool = {t: board_pool.get(t, 0) + rack_pool.get(t, 0) for t in all_tile_types}

    prob = pulp.LpProblem("Rummikub_Turn", pulp.LpMinimize)

    # x[j]: how many times combination j is used. u_rack/u_board: unused tile slack variables
    x = {j: pulp.LpVariable(f"combo_{j}", lowBound=0, cat='Integer') for j in range(len(valid_combinations))}
    u_rack = {tile: pulp.LpVariable(f"urack_{tile}", lowBound=0, upBound=rack_pool.get(tile, 0), cat='Integer') for tile in all_tile_types}
    u_board = {tile: pulp.LpVariable(f"uboard_{tile}", lowBound=0, upBound=board_pool.get(tile, 0), cat='Integer') for tile in all_tile_types}

    # Objective: minimize unused tiles. Board slack penalized heavily to prevent breaking existing groups
    prob += pulp.lpSum([u_rack[tile] + 10000 * u_board[tile] for tile in all_tile_types])

    # Conservation constraint: every tile must go somewhere — into a combination or into slack
    for tile in all_tile_types:
        combinations_using_tile = [x[j] * combo.count(tile) for j, combo in enumerate(valid_combinations) if tile in combo]
        prob += pulp.lpSum(combinations_using_tile) + u_rack[tile] + u_board[tile] == total_pool[tile]

    # Force at least one rack tile to be placed (prevents the trivial all-slack solution)
    total_rack_count = sum(rack_pool.values())
    if total_rack_count > 0:
        prob += pulp.lpSum([u_rack[tile] for tile in rack_pool.keys()]) <= total_rack_count - 1

    prob.solve(pulp.PULP_CBC_CMD(msg=False)) 
    
    if pulp.LpStatus[prob.status] == 'Optimal':
        failed_board_tiles = []
        for tile in all_tile_types:
            u_val = u_board[tile].varValue
            if u_val is not None and u_val > 0:
                failed_board_tiles.append(tile)
                
        if failed_board_tiles:
             return {"error": True, "message": f"Dictionary missing combinations for: {', '.join(failed_board_tiles)}"}
             
        solution_moves = []
        for j in x:
            x_val = x[j].varValue
            times_played = int(x_val) if x_val is not None else 0
            for _ in range(times_played): 
                solution_moves.append(valid_combinations[j])
                
        return {"error": False, "moves": solution_moves}
        
    return {"error": True, "message": "Math model crashed entirely."}

# The solver returns a list of combinations, each combination is a list of abstract type strings
# (e.g. [["Red_5", "Red_6", "Red_7"], ...]). This function replaces each string with the real
# JSON tile object (corners, position, isRack, etc.), preferring rack tiles over board tiles
# when both have the same type.
def assign_json_tiles_to_solution(solver_combinations, all_json_tiles):
    final_moves = []
    available_tiles_by_type = {}
    
    for tile_obj in all_json_tiles:
        t_type = tile_obj['tile'] 
        
        if t_type not in available_tiles_by_type:
            available_tiles_by_type[t_type] = []
        available_tiles_by_type[t_type].append(tile_obj)
        
    for t_type in available_tiles_by_type:
        available_tiles_by_type[t_type].sort(key=lambda item: item['isRack'], reverse=True)

    for combo in solver_combinations:
        assigned_combo = []
        for required_tile_type in combo:
            specific_json_tile = available_tiles_by_type[required_tile_type].pop()
            assigned_combo.append(specific_json_tile)
        final_moves.append(assigned_combo)
        
    return final_moves

def main():
    try:
        script_directory = os.path.dirname(os.path.abspath(__file__))
        
        cache_file_path = os.path.join(script_directory, "valid_combinations.json")

        with open(cache_file_path, "r") as file:
            valid_combinations_cache = json.load(file)

        # 2. Read the JSON string sent by Express from standard input
        input_data = sys.stdin.read()
        if not input_data:
            return # Exit quietly if called with no data
            
        payload = json.loads(input_data)
        rack_json = payload.get("rack", [])
        board_json_arrays = payload.get("board", [])

        # 3. Setup the pools and inject isRack flags
        board_pool = {}
        rack_pool = {}
        all_json_tiles = []
        
        for tile in rack_json:
            tile['isRack'] = True 
            all_json_tiles.append(tile)
            t_type = tile['tile'] 
            rack_pool[t_type] = rack_pool.get(t_type, 0) + 1

        for group in board_json_arrays:
            for tile in group:
                tile['isRack'] = False 
                all_json_tiles.append(tile)
                t_type = tile['tile']
                board_pool[t_type] = board_pool.get(t_type, 0) + 1

        solver_result = solve_rummikub_turn(board_pool, rack_pool, valid_combinations_cache)
        
        # 1. Check if the dictionary says there was an error
        if solver_result["error"]:
            print(json.dumps({"success": "false", "message": solver_result["message"]}))
            return
            
        # 2. If no error, explicitly grab the "moves" array out of the dictionary!
        new_board_state = assign_json_tiles_to_solution(solver_result["moves"], all_json_tiles)
        
        print(json.dumps({"success": "true", "finalBoard": new_board_state}))

    except Exception as e:
        print(json.dumps({"success": "false", "message": str(e)}))

if __name__ == "__main__":
    main()