import asyncio
import os
import pytest

from app.db import get_session, init_db
from app import models
from app.services import create_attempt, autosave_attempt, submit_attempt, ags_sync_attempt

pytestmark = pytest.mark.asyncio


async def setup_sample(db):
    # helper to create tenant/platform/course/user/item/assessment
    tenant = models.Tenant(name='test-tenant')
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    platform = models.LmsPlatform(
        tenant_id=tenant.id,
        lms_type='mock',
        issuer='https://lms.test',
        client_id='cid',
        token_url='https://token.test',
        jwks_url='',
        auth_url='',
        config={'private_key': '---FAKE-PEM---'},
    )
    db.add(platform)
    await db.commit()
    await db.refresh(platform)

    user = models.User(tenant_id=tenant.id, external_user_id='u1')
    db.add(user)
    await db.commit()
    await db.refresh(user)

    course = models.Course(tenant_id=tenant.id, lms_platform_id=platform.id, title='C')
    db.add(course)
    await db.commit()
    await db.refresh(course)

    bank = models.ItemBank(course_id=course.id, title='bank')
    db.add(bank)
    await db.commit()
    await db.refresh(bank)

    return {
        'tenant': tenant,
        'platform': platform,
        'user': user,
        'course': course,
        'bank': bank,
    }


async def test_create_attempt_and_snapshot():
    await init_db()
    async with get_session() as db:
        ctx = await setup_sample(db)
        # create one item and assessment
        it = models.Item(item_bank_id=ctx['bank'].id, type='mcq', stem='Q1', options={'choices': ['a','b']}, solution={'correct': 'b'})
        db.add(it)
        await db.commit(); await db.refresh(it)

        ass = models.Assessment(course_id=ctx['course'].id, title='A1')
        db.add(ass); await db.commit(); await db.refresh(ass)

        ai = models.AssessmentItem(assessment_id=ass.id, item_id=it.id, points=1.0)
        db.add(ai); await db.commit()

        out = await create_attempt(type('R', (), {'assessment_id': ass.id, 'user_id': ctx['user'].id})())
        # simple assertions
        assert out.assessment_id == ass.id
        # verify DB attempt exists and meta snapshot
        async with get_session() as s2:
            row = (await s2.execute(models.Attempt.__table__.select().where(models.Attempt.id == out.id))).first()
            assert row is not None
            assert 'snapshot_item_ids' in row._mapping['meta']
            assert int(it.id) in row._mapping['meta']['snapshot_item_ids']


async def test_autosave_insert_and_update():
    await init_db()
    async with get_session() as db:
        ctx = await setup_sample(db)
        it = models.Item(item_bank_id=ctx['bank'].id, type='mcq', stem='Q1', options={'choices': ['a','b']}, solution={'correct': 'b'})
        db.add(it); await db.commit(); await db.refresh(it)
        ass = models.Assessment(course_id=ctx['course'].id, title='A1')
        db.add(ass); await db.commit(); await db.refresh(ass)
        ai = models.AssessmentItem(assessment_id=ass.id, item_id=it.id, points=1.0)
        db.add(ai); await db.commit()
        out = await create_attempt(type('R', (), {'assessment_id': ass.id, 'user_id': ctx['user'].id})())

        ok = await autosave_attempt(out.id, type('R', (), {'responses': {str(it.id): 'a'}})())
        assert ok
        # verify stored
        async with get_session() as s2:
            res = await s2.execute(models.AttemptItem.__table__.select().where(models.AttemptItem.attempt_id == out.id))
            rows = res.fetchall()
            assert len(rows) == 1
            assert rows[0]._mapping['response'] == 'a'
        # update
        ok2 = await autosave_attempt(out.id, type('R', (), {'responses': {str(it.id): 'b'}})())
        assert ok2
        async with get_session() as s3:
            res2 = await s3.execute(models.AttemptItem.__table__.select().where(models.AttemptItem.attempt_id == out.id))
            rows2 = res2.fetchall()
            assert len(rows2) == 1
            assert rows2[0]._mapping['response'] == 'b'


async def test_submit_grading_mcq_numeric_msq():
    await init_db()
    async with get_session() as db:
        ctx = await setup_sample(db)
        # create mcq item
        it1 = models.Item(item_bank_id=ctx['bank'].id, type='mcq', stem='Q1', options={'choices': ['1','2']}, solution={'correct': '2'})
        db.add(it1); await db.commit(); await db.refresh(it1)
        # numeric
        it2 = models.Item(item_bank_id=ctx['bank'].id, type='numeric', stem='Q2', solution={'value': 3, 'tolerance': 0.1})
        db.add(it2); await db.commit(); await db.refresh(it2)
        # msq
        it3 = models.Item(item_bank_id=ctx['bank'].id, type='msq', stem='Q3', solution={'correct': ['a','b']})
        db.add(it3); await db.commit(); await db.refresh(it3)

        ass = models.Assessment(course_id=ctx['course'].id, title='A1')
        db.add(ass); await db.commit(); await db.refresh(ass)
        db.add(models.AssessmentItem(assessment_id=ass.id, item_id=it1.id, points=1.0))
        db.add(models.AssessmentItem(assessment_id=ass.id, item_id=it2.id, points=2.0))
        db.add(models.AssessmentItem(assessment_id=ass.id, item_id=it3.id, points=3.0))
        await db.commit()

        out = await create_attempt(type('R', (), {'assessment_id': ass.id, 'user_id': ctx['user'].id})())
        # autosave answers
        await autosave_attempt(out.id, type('R', (), {'responses': {str(it1.id): '2', str(it2.id): '3', str(it3.id): ['a','b']}})())
        res = await submit_attempt(out.id)
        assert res is not None
        assert res.status == 'submitted'
        # score should be 1+2+3 =6
        assert abs(res.score - 6.0) < 0.001


async def test_ags_sync_success_and_failure(monkeypatch):
    await init_db()
    async with get_session() as db:
        ctx = await setup_sample(db)
        it = models.Item(item_bank_id=ctx['bank'].id, type='mcq', stem='Q1', options={'choices': ['a','b']}, solution={'correct': 'b'})
        db.add(it); await db.commit(); await db.refresh(it)
        ass = models.Assessment(course_id=ctx['course'].id, title='A1', lineitem_url='https://lms.test/lineitem')
        db.add(ass); await db.commit(); await db.refresh(ass)
        db.add(models.AssessmentItem(assessment_id=ass.id, item_id=it.id, points=1.0)); await db.commit()
        out = await create_attempt(type('R', (), {'assessment_id': ass.id, 'user_id': ctx['user'].id})())
        await autosave_attempt(out.id, type('R', (), {'responses': {str(it.id): 'b'}})())
        await submit_attempt(out.id)

        # monkeypatch token and post to succeed
        async def fake_token(url, client_id, scope, pk):
            return 'tok'
        async def fake_post(url, token, payload):
            return {'ok': True}
        monkeypatch.setattr('app.services.request_client_token', fake_token)
        monkeypatch.setattr('app.services.post_score_to_ags', fake_post)

        ok = await ags_sync_attempt(out.id)
        assert ok is not None
        assert ok.status == 'success'
        # verify grade sync record written and attempt.lms_grade_synced True
        async with get_session() as s2:
            a = (await s2.execute(models.Attempt.__table__.select().where(models.Attempt.id == out.id))).first()
            assert a._mapping['lms_grade_synced'] in (1, True)
            recs = (await s2.execute(models.GradeSyncRecord.__table__.select().where(models.GradeSyncRecord.attempt_id == out.id))).fetchall()
            assert any(r._mapping['status'] == 'success' for r in recs)

        # now monkeypatch token to raise
        async def bad_token(url, client_id, scope, pk):
            raise Exception('nope')
        monkeypatch.setattr('app.services.request_client_token', bad_token)
        bad = await ags_sync_attempt(out.id)
        assert bad is not None
        assert bad.status == 'failed'
        async with get_session() as s3:
            recs2 = (await s3.execute(models.GradeSyncRecord.__table__.select().where(models.GradeSyncRecord.attempt_id == out.id))).fetchall()
            assert any(r._mapping['status'] == 'failed' for r in recs2)
