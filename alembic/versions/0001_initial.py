"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2026-04-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import os

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use the models metadata to create tables
    # This requires that app.models is importable; alembic env is configured to add src to path.
    from app import models
    bind = op.get_bind()
    models.Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app import models
    bind = op.get_bind()
    models.Base.metadata.drop_all(bind=bind)
