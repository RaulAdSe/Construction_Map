from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.models.project import ProjectUser
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectDetail, ProjectUserCreate, ProjectUserUpdate
from app.services import project as project_service

router = APIRouter()


@router.get("/", response_model=List[Project])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all projects accessible by the current user.
    """
    projects = project_service.get_user_projects(db, current_user.id, skip, limit)
    return projects


@router.post("/", response_model=Project)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new project.
    The creator will automatically be assigned the ADMIN role.
    """
    project = project_service.create_project(
        db, 
        name=project_in.name, 
        description=project_in.description
    )
    
    # Add current user to the project as an ADMIN
    project_service.add_user_to_project(db, project.id, current_user.id, "ADMIN")
    
    return project


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get details of a specific project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get additional stats
    project_detail = ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        is_active=project.is_active,
        users=[],  # Will be populated by ORM
        user_count=len(project.users),
        map_count=len(project.maps),
        event_count=len(project.events)
    )
    
    return project_detail


@router.put("/{project_id}", response_model=Project)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update project details.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update project
    updated_project = project_service.update_project(
        db,
        project_id,
        name=project_in.name,
        description=project_in.description,
        is_active=project_in.is_active
    )
    
    return updated_project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Delete project
        success = project_service.delete_project(db, project_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete project. Check server logs for details.")
        
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting project: {str(e)}")


@router.post("/{project_id}/users", status_code=status.HTTP_201_CREATED)
def add_user_to_project(
    project_id: int,
    user_data: ProjectUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add a user to a project.
    Only ADMIN users can add users to a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin for this project
    if not project_service.has_project_permission(db, project_id, current_user.id, "ADMIN"):
        raise HTTPException(status_code=403, detail="Not enough permissions: ADMIN role required")
    
    # Add user to project with the specified role (or default to MEMBER)
    project_user = project_service.add_user_to_project(db, project_id, user_data.user_id, user_data.role)
    if not project_user:
        raise HTTPException(status_code=400, detail="Failed to add user to project")
    
    return {"status": "success", "message": f"User added to project with role: {project_user.role}"}


@router.delete("/{project_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_from_project(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove a user from a project.
    Only ADMIN users can remove members from a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin
    if not project_service.has_project_permission(db, project_id, current_user.id, "ADMIN"):
        raise HTTPException(status_code=403, detail="Not enough permissions: ADMIN role required")
    
    # Don't allow removing yourself if you're the only admin
    if user_id == current_user.id:
        # Check if there are other admins in the project
        admin_count = db.query(ProjectUser).filter(
            ProjectUser.project_id == project_id,
            ProjectUser.role == "ADMIN",
            ProjectUser.user_id != current_user.id
        ).count()
        
        if admin_count == 0:
            raise HTTPException(
                status_code=400, 
                detail="Cannot remove yourself as you are the only admin. Assign another admin first."
            )
    
    # Remove user from project
    success = project_service.remove_user_from_project(db, project_id, user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to remove user from project")
    
    return None


@router.get("/debug", response_model=dict)
def debug_project(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Debug endpoint to check project relationships and structures.
    """
    from app.models.project import Project
    from app.models.map import Map
    from app.models.event import Event
    from app.models.project import ProjectUser
    
    try:
        # Get counts
        project_count = db.query(Project).count()
        projectuser_count = db.query(ProjectUser).count()
        map_count = db.query(Map).count()
        event_count = db.query(Event).count()
        
        # Check what other models depend on Project
        tables_with_fk = []
        for table in db.get_bind().table_names():
            if table != 'projects':
                query = f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'project_id'"
                result = db.execute(query).fetchone()
                if result:
                    tables_with_fk.append(table)
        
        return {
            "counts": {
                "projects": project_count,
                "project_users": projectuser_count,
                "maps": map_count,
                "events": event_count
            },
            "tables_with_project_fk": tables_with_fk,
            "project_model_relationships": [rel.key for rel in Project.__mapper__.relationships],
            "cascade_settings": {
                "maps": "all, delete-orphan" if "all, delete-orphan" in str(Project.__mapper__.relationships['maps'].cascade) else "none",
                "events": "all, delete-orphan" if "all, delete-orphan" in str(Project.__mapper__.relationships['events'].cascade) else "none",
                "users": "all, delete-orphan" if "all, delete-orphan" in str(Project.__mapper__.relationships['users'].cascade) else "none"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting debug info: {str(e)}")


@router.get("/{project_id}/members", response_model=List[dict])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all members of a project with their contact information.
    This endpoint is accessible to all project members.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not project_service.has_project_permission(db, project_id, current_user.id, "MEMBER"):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update last access time
    project_service.update_user_last_access(db, project_id, current_user.id)
    
    # Get all project users with their info
    users = db.query(User).join(ProjectUser).filter(ProjectUser.project_id == project_id).all()
    
    # Format user data for response
    result = []
    for user in users:
        user_role = project_service.get_user_project_role(db, project_id, user.id)
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user_role,
            "is_active": user.is_active
        })
    
    return result


@router.put("/{project_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
def update_member_role(
    project_id: int,
    user_id: int,
    role_data: ProjectUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a member's role in a project.
    Only project ADMINs can update roles.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin
    if not project_service.has_project_permission(db, project_id, current_user.id, "ADMIN"):
        raise HTTPException(status_code=403, detail="Not enough permissions: ADMIN role required")
    
    # Check if target user exists and is a member of the project
    target_role = project_service.get_user_project_role(db, project_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="User not found in this project")
    
    # Update the role
    success = project_service.update_user_project_role(db, project_id, user_id, role_data.role)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update user role")
    
    return {"status": "success", "message": f"User role updated to {role_data.role}"} 