"""Initial TrueVoice Database Schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-18 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extensions (for PostgreSQL)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        op.execute('CREATE EXTENSION IF NOT EXISTS "vector";')

    # 2. Organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('tenant_code', sa.String(64), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_org_tenant_code', 'organizations', ['tenant_code'])

    # 3. Users
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_user_org_id', 'users', ['org_id'])
    op.create_index('idx_user_email', 'users', ['email'])

    # 4. Policies
    op.create_table(
        'policies',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_name', sa.String(100), nullable=False),
        sa.Column('caution_threshold', sa.Float(), nullable=False, default=30.0),
        sa.Column('verify_threshold', sa.Float(), nullable=False, default=60.0),
        sa.Column('block_threshold', sa.Float(), nullable=False, default=80.0),
        sa.Column('enforce_transaction_lock', sa.Boolean(), nullable=False, default=True),
        sa.Column('sensitive_amount_threshold', sa.Float(), nullable=False, default=250000.0),
        sa.Column('oob_timeout_seconds', sa.Integer(), nullable=False, default=30),
        sa.Column('version', sa.String(32), nullable=False, default='1.0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_policy_org_id', 'policies', ['org_id'])

    # 5. Speaker Profiles
    op.create_table(
        'speaker_profiles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('display_name', sa.String(150), nullable=False),
        sa.Column('designation', sa.String(100), nullable=False),
        sa.Column('consent_timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_speaker_org_id', 'speaker_profiles', ['org_id'])

    # 6. Voiceprint Embeddings (Vector 192)
    vec_type = Vector(192) if bind.dialect.name == "postgresql" else sa.String()
    op.create_table(
        'voiceprint_embeddings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('speaker_profile_id', sa.String(36), sa.ForeignKey('speaker_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('embedding', vec_type, nullable=False),
        sa.Column('quality_score', sa.Float(), nullable=False, default=1.0),
        sa.Column('sample_duration_seconds', sa.Float(), nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_voiceprint_speaker_id', 'voiceprint_embeddings', ['speaker_profile_id'])
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX idx_voiceprint_cosine ON voiceprint_embeddings "
            "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);"
        )

    # 7. Model Versions
    op.create_table(
        'model_versions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('version_tag', sa.String(50), nullable=False, unique=True),
        sa.Column('weights_digest', sa.String(64), nullable=False),
        sa.Column('checkpoint_uri', sa.String(255), nullable=True),
        sa.Column('configuration', sa.JSON(), nullable=False),
        sa.Column('deployed_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_model_version_tag', 'model_versions', ['version_tag'])

    # 8. Call Sessions
    op.create_table(
        'call_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(64), nullable=False, unique=True),
        sa.Column('claimed_speaker_id', sa.String(36), sa.ForeignKey('speaker_profiles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('caller_ani', sa.String(32), nullable=False, default='UNKNOWN'),
        sa.Column('context_metadata', sa.JSON(), nullable=False),
        sa.Column('current_trust_state', sa.String(32), nullable=False, default='OBSERVING'),
        sa.Column('peak_risk_score', sa.Float(), nullable=False, default=0.0),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_session_org_id', 'call_sessions', ['org_id'])
    op.create_index('idx_session_token', 'call_sessions', ['session_token'])

    # 9. Risk Assessments
    op.create_table(
        'risk_assessments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('call_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('model_version_id', sa.String(36), sa.ForeignKey('model_versions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sequence_id', sa.Integer(), nullable=False),
        sa.Column('synthetic_prob', sa.Float(), nullable=False),
        sa.Column('speaker_similarity', sa.Float(), nullable=True),
        sa.Column('forensic_score', sa.Float(), nullable=False),
        sa.Column('conversational_score', sa.Float(), nullable=False),
        sa.Column('composite_risk', sa.Float(), nullable=False),
        sa.Column('risk_tier', sa.String(16), nullable=False),
        sa.Column('primary_factors', sa.JSON(), nullable=False),
        sa.Column('evidence_provenance', sa.JSON(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_risk_session_id', 'risk_assessments', ['session_id'])

    # 10. Conversation Analyses
    op.create_table(
        'conversation_analyses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('call_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sequence_id', sa.Integer(), nullable=False),
        sa.Column('transcript_redacted', sa.Text(), nullable=False),
        sa.Column('detected_intent_flags', sa.JSON(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_conv_session_id', 'conversation_analyses', ['session_id'])

    # 11. Verification Events
    op.create_table(
        'verification_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('call_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('challenge_type', sa.String(32), nullable=False),
        sa.Column('challenge_token', sa.String(64), nullable=False, unique=True),
        sa.Column('nonce', sa.String(64), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, default='PENDING'),
        sa.Column('attempt_count', sa.Integer(), nullable=False, default=0),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_verify_session_id', 'verification_events', ['session_id'])
    op.create_index('idx_verify_token', 'verification_events', ['challenge_token'])

    # 12. Security Actions
    op.create_table(
        'security_actions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('call_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_id', sa.String(36), sa.ForeignKey('policies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action_type', sa.String(64), nullable=False),
        sa.Column('triggered_by', sa.String(32), nullable=False),
        sa.Column('triggering_reason', sa.Text(), nullable=False),
        sa.Column('execution_status', sa.String(32), nullable=False, default='PENDING'),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_action_session_id', 'security_actions', ['session_id'])

    # 13. Audit Logs (Hash-Chained)
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('call_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sequence_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(64), nullable=False),
        sa.Column('prev_event_hash', sa.String(64), nullable=False),
        sa.Column('event_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('trust_state', sa.String(32), nullable=False),
        sa.Column('payload_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_audit_session_id', 'audit_logs', ['session_id'])
    op.create_index('idx_audit_event_hash', 'audit_logs', ['event_hash'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('security_actions')
    op.drop_table('verification_events')
    op.drop_table('conversation_analyses')
    op.drop_table('risk_assessments')
    op.drop_table('call_sessions')
    op.drop_table('model_versions')
    op.drop_table('voiceprint_embeddings')
    op.drop_table('speaker_profiles')
    op.drop_table('policies')
    op.drop_table('users')
    op.drop_table('organizations')
