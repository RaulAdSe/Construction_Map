"""
Compatibility module for project_user imports.
This module re-exports the ProjectUser class from project.py 
to maintain backward compatibility with code that imports from app.models.project_user.
"""

from app.models.project import ProjectUser

# Re-export the ProjectUser class
__all__ = ["ProjectUser"] 