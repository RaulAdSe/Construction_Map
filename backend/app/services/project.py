from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.project import Project, ProjectUser
from app.models.user import User


def get_project(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
    return db.query(Project).offset(skip).limit(limit).all()


def get_user_projects(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Project]:
    return (db.query(Project)
              .join(ProjectUser)
              .filter(ProjectUser.user_id == user_id)
              .offset(skip)
              .limit(limit)
              .all())


def create_project(db: Session, name: str, description: Optional[str] = None) -> Project:
    project = Project(name=name, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session, 
    project_id: int, 
    name: Optional[str] = None, 
    description: Optional[str] = None, 
    is_active: Optional[bool] = None
) -> Optional[Project]:
    project = get_project(db, project_id)
    if not project:
        return None
    
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    if is_active is not None:
        project.is_active = is_active
    
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> bool:
    try:
        # Get the project first to check if it exists
        project = get_project(db, project_id)
        if not project:
            return False
            
        # Log deletion attempt
        print(f"Attempting to delete project with ID {project_id} - '{project.name}'")
        
        # Important: Expire all objects from the session to avoid dependency tracking issues
        db.expire_all()
        
        # Get direct database connection for raw SQL execution
        connection = db.connection()
        
        # Check for any other potential tables with project_id foreign keys
        # that might not be explicitly defined in our model relationships
        check_query = """
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name = 'project_id' 
            AND table_schema = 'public'
        """
        dependent_tables = connection.execute(text(check_query)).fetchall()
        print(f"Found dependent tables: {[table[0] for table in dependent_tables]}")
        
        # Start a subtransaction
        with connection.begin():
            # 1. First check if there are any other tables referencing project_id that we need to handle
            # The standard tables we know about are: events, maps, project_users
            for table_name, _ in dependent_tables:
                if table_name not in ['events', 'maps', 'project_users', 'projects']:
                    print(f"Deleting records from additional table: {table_name}")
                    connection.execute(
                        text(f"DELETE FROM {table_name} WHERE project_id = :project_id"),
                        {"project_id": project_id}
                    )
            
            # 2. Delete events (which might have dependencies)
            print(f"Deleting events for project {project_id}")
            connection.execute(
                text("DELETE FROM events WHERE project_id = :project_id"),
                {"project_id": project_id}
            )
            
            # 3. Delete maps
            print(f"Deleting maps for project {project_id}")
            connection.execute(
                text("DELETE FROM maps WHERE project_id = :project_id"),
                {"project_id": project_id}
            )
            
            # 4. Delete project_users associations
            print(f"Deleting project_users associations for project {project_id}")
            connection.execute(
                text("DELETE FROM project_users WHERE project_id = :project_id"),
                {"project_id": project_id}
            )
            
            # 5. Finally, delete the project itself
            print(f"Deleting project {project_id}")
            result = connection.execute(
                text("DELETE FROM projects WHERE id = :project_id"),
                {"project_id": project_id}
            )
            deleted_count = result.rowcount
            print(f"Deleted {deleted_count} projects")
        
        # Commit the main transaction
        db.commit()
        print(f"Project {project_id} successfully deleted")
        return True
    except Exception as e:
        print(f"Error deleting project: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False


def add_user_to_project(db: Session, project_id: int, user_id: int) -> Optional[ProjectUser]:
    # Check if project and user exist
    project = get_project(db, project_id)
    user = db.query(User).filter(User.id == user_id).first()
    
    if not project or not user:
        return None
    
    # Check if user is already in project
    project_user = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id
    ).first()
    
    if project_user:
        return project_user
    
    # Add user to project
    project_user = ProjectUser(project_id=project_id, user_id=user_id)
    db.add(project_user)
    db.commit()
    db.refresh(project_user)
    return project_user


def remove_user_from_project(db: Session, project_id: int, user_id: int) -> bool:
    project_user = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id
    ).first()
    
    if not project_user:
        return False
    
    db.delete(project_user)
    db.commit()
    return True


def get_project_users(db: Session, project_id: int) -> List[User]:
    return (db.query(User)
              .join(ProjectUser)
              .filter(ProjectUser.project_id == project_id)
              .all()) 