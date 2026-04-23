import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    JSON,
    Boolean,
    ForeignKey,
    Numeric,
)
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    config = Column(JSON, nullable=False, default=dict)
    branding = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class LmsPlatform(Base):
    __tablename__ = "lms_platforms"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    lms_type = Column(String(50), nullable=False)
    issuer = Column(String(512), nullable=False, index=True)
    client_id = Column(String(255), nullable=True)
    auth_url = Column(String(1024), nullable=True)
    token_url = Column(String(1024), nullable=True)
    jwks_url = Column(String(1024), nullable=True)
    deployment_ids = Column(JSON, nullable=False, default=list)
    redirect_uris = Column(JSON, nullable=False, default=list)
    config = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", backref="platforms")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    actor_user_id = Column(Integer, nullable=True)
    action = Column(String(255), nullable=False)
    resource = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# --- Core user/course models ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    lms_platform_id = Column(Integer, ForeignKey("lms_platforms.id"), nullable=True)
    external_user_id = Column(String(255), nullable=True, index=True)
    role = Column(String(50), nullable=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    profile = Column(JSON, nullable=False, default=dict)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", backref="users")
    platform = relationship("LmsPlatform", backref="users")


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    lms_platform_id = Column(Integer, ForeignKey("lms_platforms.id"), nullable=True)
    external_course_id = Column(String(255), nullable=True, index=True)
    title = Column(String(512), nullable=False)
    meta = Column('metadata', JSON, nullable=False, default=dict)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", backref="courses")
    platform = relationship("LmsPlatform", backref="courses")


# --- Assessment models ---
class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    settings = Column(JSON, nullable=False, default=dict)
    lineitem_url = Column(String(1024), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    course = relationship("Course", backref="assessments")
    sections = relationship("Section", back_populates="assessment", cascade="all, delete-orphan")


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    title = Column(String(255), nullable=True)
    order_idx = Column(Integer, default=0)
    settings = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    assessment = relationship("Assessment", back_populates="sections")
    assessment_items = relationship("AssessmentItem", back_populates="section")


class ItemBank(Base):
    __tablename__ = "item_banks"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    title = Column(String(255), nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    meta = Column('metadata', JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    course = relationship("Course", backref="item_banks")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    item_bank_id = Column(Integer, ForeignKey("item_banks.id"), nullable=True)
    type = Column(String(50), nullable=False)
    stem = Column(Text, nullable=False)
    options = Column(JSON, nullable=False, default=dict)
    solution = Column(JSON, nullable=False, default=dict)
    meta = Column('metadata', JSON, nullable=False, default=dict)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    bank = relationship("ItemBank", backref="items")


class AssessmentItem(Base):
    __tablename__ = "assessment_items"
    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    points = Column(Numeric(8, 2), default=1.00)
    order_idx = Column(Integer, default=0)
    randomization_group = Column(String(100), nullable=True)
    config = Column(JSON, nullable=False, default=dict)

    assessment = relationship("Assessment", backref="assessment_items")
    item = relationship("Item")
    section = relationship("Section", back_populates="assessment_items")


# --- Attempts and grading ---
class Attempt(Base):
    __tablename__ = "attempts"
    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(32), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    score = Column(Numeric(8,2), nullable=True)
    max_score = Column(Numeric(8,2), nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    lms_grade_synced = Column(Boolean, default=False)
    meta = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    assessment = relationship("Assessment", backref="attempts")
    user = relationship("User", backref="attempts")
    items = relationship("AttemptItem", back_populates="attempt", cascade="all, delete-orphan")


class AttemptItem(Base):
    __tablename__ = "attempt_items"
    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    response = Column(JSON, nullable=False, default=dict)
    score = Column(Numeric(8,2), nullable=True)
    max_score = Column(Numeric(8,2), nullable=True)
    feedback = Column(JSON, nullable=False, default=dict)
    time_spent_seconds = Column(Integer, nullable=True)
    answered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    attempt = relationship("Attempt", back_populates="items")
    item = relationship("Item")


class GradeSyncRecord(Base):
    __tablename__ = "grade_sync_records"
    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False)
    lineitem_url = Column(String(1024), nullable=True)
    score_sent = Column(Numeric(8,2), nullable=True)
    status = Column(String(32), nullable=False)
    last_error = Column(Text, nullable=True)
    tried_at = Column(DateTime, default=datetime.datetime.utcnow)

    attempt = relationship("Attempt", backref="grade_sync_records")


class LtiLink(Base):
    __tablename__ = "lti_links"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    resource_link_id = Column(String(255), nullable=False, index=True)
    deep_link_data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    assessment = relationship("Assessment", backref="lti_links")
    tenant = relationship("Tenant", backref="lti_links")
