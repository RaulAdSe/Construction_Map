from app.db.database import SessionLocal
from app.models.map import Map
import sys

def fix_maps():
    # Connect to the database
    db = SessionLocal()
    try:
        # Get all maps for project ID 1
        maps = db.query(Map).filter(Map.project_id == 1).all()
        
        print(f"Found {len(maps)} maps for project ID 1")
        print("\nCurrent map types:")
        for i, m in enumerate(maps):
            print(f"ID: {m.id}, Name: {m.name}, Type: {m.map_type}")
        
        # Check if there are any maps
        if not maps:
            print("No maps found to fix.")
            return
        
        # Find all maps with implantation type
        main_maps = [m for m in maps if m.map_type == 'implantation']
        print(f"\nFound {len(main_maps)} main maps")
        
        # No main maps found, set the first map as main
        if len(main_maps) == 0:
            print("No main maps found. Setting first map as main.")
            maps[0].map_type = 'implantation'
            db.commit()
            print(f"Set map '{maps[0].name}' (ID: {maps[0].id}) as main map")
        
        # Multiple main maps found, keep only the first one as main
        elif len(main_maps) > 1:
            print("Multiple main maps found. Keeping only the first one as main.")
            
            # Keep the first one as main
            keep_main = main_maps[0]
            print(f"Keeping '{keep_main.name}' (ID: {keep_main.id}) as main map")
            
            # Change all others to overlay
            for m in main_maps[1:]:
                print(f"Changing '{m.name}' (ID: {m.id}) from 'implantation' to 'overlay'")
                m.map_type = 'overlay'
            
            # Commit changes
            db.commit()
            print("Changes committed to database")
        
        # Verify changes
        print("\nVerifying map types after update:")
        maps = db.query(Map).filter(Map.project_id == 1).all()
        for m in maps:
            print(f"ID: {m.id}, Name: {m.name}, Type: {m.map_type}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting map type fix script...")
    fix_maps()
    print("\nMap fix script completed. Please restart the servers for changes to take effect.")
    print("To restart servers: ./stop_servers.sh && ./start_servers.sh") 