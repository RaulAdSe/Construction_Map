from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.models.project import ProjectUser
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectDetail, ProjectUserCreate, ProjectUserUpdate
from app.schemas.user import User as UserSchema
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
    Admin users can access all projects.
    """
    # If the user is an admin, return all projects
    if current_user.is_admin:
        projects = project_service.get_all_projects(db, skip, limit)
    else:
        # Otherwise, return only projects the user is a member of
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
    Admin users can access any project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project or is an admin
    if not current_user.is_admin and not any(pu.user_id == current_user.id for pu in project.users):
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
    Admin users can update any project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project or is an admin
    if not current_user.is_admin and not any(pu.user_id == current_user.id for pu in project.users):
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
    Admin users can delete any project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project or is an admin
    if not current_user.is_admin and not any(pu.user_id == current_user.id for pu in project.users):
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
    Only admin users can add users to a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions: Admin role required")
    
    # Add user to project (role field is no longer used)
    project_user = project_service.add_user_to_project(db, project_id, user_data.user_id)
    if not project_user:
        raise HTTPException(status_code=400, detail="Failed to add user to project")
    
    return {"status": "success", "message": "User added to project successfully"}


@router.delete("/{project_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_from_project(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove a user from a project.
    Only admin users can remove members from a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions: Admin role required")
    
    # Check if user is trying to remove themselves
    if user_id == current_user.id:
        # Check if there are other users in the project
        user_count = db.query(ProjectUser).filter(
            ProjectUser.project_id == project_id
        ).count()
        
        if user_count <= 1:
            raise HTTPException(
                status_code=400, 
                detail="Cannot remove yourself as you are the only user in the project."
            )
    
    # Check if target user exists and is an admin
    target_user = db.query(User).filter(User.id == user_id).first()
    
    # Don't allow non-admin users to remove admin users
    # But admin users can remove other admin users (and themselves)
    if target_user and target_user.is_admin and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Cannot remove an admin user. Only admins can remove other admins."
        )
    
    # Remove user from project
    if not project_service.remove_user_from_project(db, project_id, user_id):
        raise HTTPException(status_code=404, detail="User not found in project")
    
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
    Get all members of a project.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project or is an admin
    if not current_user.is_admin and not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get all members of the project
    members = project_service.get_project_users(db, project_id)
    return members


@router.put("/{project_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
def update_member_role(
    project_id: int,
    user_id: int,
    role_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a user's admin status.
    Only admin users can make this change.
    """
    # Check if project exists
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is an admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions: Admin role required")
    
    # Check if target user exists and is a member of the project
    if not project_service.has_project_permission(db, project_id, user_id):
        raise HTTPException(status_code=404, detail="User not found in this project")
    
    # Get new role value (interpret as boolean admin status)
    target_role = role_data.get("role", "MEMBER")
    is_admin = target_role.upper() == "ADMIN" if isinstance(target_role, str) else bool(target_role)
    
    # Don't allow changing another admin's role
    target_user = db.query(User).filter(User.id == user_id).first()
    if target_user.is_admin and user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Cannot modify admin status of other admin users"
        )
    
    # Update the role
    success = project_service.update_user_project_role(db, project_id, user_id, is_admin)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update user role")
    
    return {"status": "success", "message": f"User admin status updated to: {is_admin}"}


@router.put("/{project_id}/members/{user_id}/field", status_code=status.HTTP_200_OK)
def update_member_field(
    project_id: int,
    user_id: int,
    field_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a member's field/area in a project.
    Only admin users can update fields.
    """
    # Log the operation
    print(f"API: update_member_field - project {project_id}, user {user_id}, data: {field_data}")
    
    try:
        # Check if project exists
        project = project_service.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if current user is an admin
        print(f"Current user: {current_user.username}, is_admin: {current_user.is_admin}")
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not enough permissions: Admin role required")
        
        # Check if target user exists and is a member of the project
        if not project_service.has_project_permission(db, project_id, user_id):
            raise HTTPException(status_code=404, detail="User not found in this project")
        
        # Get field value from request
        field = field_data.get("field", "")
        print(f"Field value to be set: '{field}'")
        
        # Update the field
        success = project_service.update_user_field(db, project_id, user_id, field)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update user field")
        
        return {"status": "success", "message": "User field updated successfully", "field": field}
    except Exception as e:
        print(f"Error in update_member_field: {str(e)}")
        raise 