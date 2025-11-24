"""Initial migration - Legal Advocate AI schema

Revision ID: 001_initial
Revises:
Create Date: 2025-10-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all initial tables"""

    # Create deadlines table
    op.create_table(
        'deadlines',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_number', sa.String(50), nullable=False, index=True),
        sa.Column('user_id', sa.String(100), nullable=False, index=True),
        sa.Column('deadline_type', sa.String(20), nullable=False),
        sa.Column('deadline_date', sa.DateTime(), nullable=False, index=True),
        sa.Column('action_required', sa.Text(), nullable=False),
        sa.Column('responsible_party', sa.String(50)),
        sa.Column('source_document', sa.Text()),
        sa.Column('source_text', sa.Text()),
        sa.Column('extraction_confidence', sa.Float()),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('alerted_at', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime())
    )

    # Create composite indexes for deadlines
    op.create_index('idx_user_status', 'deadlines', ['user_id', 'status'])
    op.create_index('idx_case_deadline', 'deadlines', ['case_number', 'deadline_date'])
    op.create_index('idx_user_deadline', 'deadlines', ['user_id', 'deadline_date'])

    # Create requests table
    op.create_table(
        'requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_number', sa.String(50), nullable=False, index=True),
        sa.Column('user_id', sa.String(100), nullable=False, index=True),
        sa.Column('request_type', sa.String(50), nullable=False),
        sa.Column('what_is_needed', sa.Text(), nullable=False),
        sa.Column('requested_by', sa.String(200), nullable=False),
        sa.Column('requested_date', sa.DateTime(), nullable=False),
        sa.Column('deadline', sa.DateTime()),
        sa.Column('urgency', sa.String(20), server_default='normal'),
        sa.Column('source_email_id', sa.String(200)),
        sa.Column('source_text', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )

    # Create composite indexes for requests
    op.create_index('idx_user_status_requests', 'requests', ['user_id', 'status'])
    op.create_index('idx_case_urgency', 'requests', ['case_number', 'urgency'])
    op.create_index('idx_user_deadline_requests', 'requests', ['user_id', 'deadline'])

    # Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('deadline_id', sa.String(36), sa.ForeignKey('deadlines.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alert_type', sa.String(20), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False, index=True),
        sa.Column('sent_at', sa.DateTime()),
        sa.Column('status', sa.String(20), nullable=False, server_default='scheduled'),
        sa.Column('channel', sa.String(20), server_default='email'),
        sa.Column('error_message', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )

    # Create composite indexes for alerts
    op.create_index('idx_status_scheduled', 'alerts', ['status', 'scheduled_at'])
    op.create_index('idx_deadline_alert', 'alerts', ['deadline_id', 'alert_type'])

    # Create cases table
    op.create_table(
        'cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_number', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('user_id', sa.String(100), nullable=False, index=True),
        sa.Column('case_title', sa.String(200)),
        sa.Column('case_type', sa.String(50)),
        sa.Column('court_name', sa.String(200)),
        sa.Column('filing_date', sa.DateTime()),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('mycase_url', sa.Text()),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime())
    )

    # Create composite indexes for cases
    op.create_index('idx_user_case_number', 'cases', ['user_id', 'case_number'])
    op.create_index('idx_case_user_status', 'cases', ['user_id', 'status'])

    # Create completion_tracking table
    op.create_table(
        'completion_tracking',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('item_type', sa.String(20), nullable=False),
        sa.Column('item_id', sa.String(36), nullable=False, index=True),
        sa.Column('user_id', sa.String(100), nullable=False, index=True),
        sa.Column('completed_at', sa.DateTime(), nullable=False),
        sa.Column('completion_method', sa.String(50)),
        sa.Column('completion_notes', sa.Text()),
        sa.Column('verified_by', sa.String(100)),
        sa.Column('verification_source', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )

    # Create composite indexes for completion_tracking
    op.create_index('idx_item_type_id', 'completion_tracking', ['item_type', 'item_id'])
    op.create_index('idx_user_completed', 'completion_tracking', ['user_id', 'completed_at'])


def downgrade() -> None:
    """Drop all tables"""
    op.drop_table('completion_tracking')
    op.drop_table('alerts')
    op.drop_table('cases')
    op.drop_table('requests')
    op.drop_table('deadlines')
