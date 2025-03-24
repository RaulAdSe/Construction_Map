from app.db.database import SessionLocal
from app.models.map import Map
from app.models.project import Project
from sqlalchemy.sql import func
import os

# Create a sample map for the first project
def create_sample_map():
    db = SessionLocal()
    try:
        # Check if there are any projects
        project = db.query(Project).first()
        if not project:
            print("No projects found. Please create a project first.")
            return
            
        # Check if project already has maps
        existing_maps = db.query(Map).filter(Map.project_id == project.id).count()
        if existing_maps > 0:
            print(f"Project {project.name} already has {existing_maps} maps.")
            return
            
        # Create a sample map
        map_obj = Map(
            project_id=project.id,
            map_type="implantation",
            name="Sample Map",
            filename="sample.pdf",  # This is a placeholder, we'll use a real file
            transform_data={},
            uploaded_at=func.now()
        )
        
        db.add(map_obj)
        db.commit()
        db.refresh(map_obj)
        
        print(f"Created sample map with ID {map_obj.id} for project {project.name}")
    except Exception as e:
        print(f"Error creating sample map: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_map()
