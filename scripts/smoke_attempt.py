import asyncio
import sys
sys.path.append(r'g:/village strong/src')

from app.db import get_session, init_db
from app import models
from app.schemas import CreateAttemptRequest, AutosaveRequest
from app.services import create_attempt, autosave_attempt, submit_attempt, ags_sync_attempt

async def main():
    # ensure DB exists (no-op if already created)
    await init_db()

    async with get_session() as session:
        # create tenant
        tenant = models.Tenant(name='dev')
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)

        # platform
        platform = models.LmsPlatform(tenant_id=tenant.id, lms_type='moodle', issuer='https://lms.example', client_id='client-1', token_url='https://example.invalid/token', jwks_url='', auth_url='', config={'private_key': '---FAKE---'})
        session.add(platform)
        await session.commit()
        await session.refresh(platform)

        # user
        user = models.User(tenant_id=tenant.id, external_user_id='u1')
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # course
        course = models.Course(tenant_id=tenant.id, lms_platform_id=platform.id, title='Test Course')
        session.add(course)
        await session.commit()
        await session.refresh(course)

        # item bank and item
        bank = models.ItemBank(course_id=course.id, title='bank1')
        session.add(bank)
        await session.commit()
        await session.refresh(bank)

        item = models.Item(item_bank_id=bank.id, type='mcq', stem='What is 2+2?', options={'choices': ['3','4']}, solution={'correct': '4'})
        session.add(item)
        await session.commit()
        await session.refresh(item)

        # assessment
        assessment = models.Assessment(course_id=course.id, title='Test Assessment', lineitem_url='https://lms.example/lineitem')
        session.add(assessment)
        await session.commit()
        await session.refresh(assessment)

        # assessment item
        ass_item = models.AssessmentItem(assessment_id=assessment.id, item_id=item.id, points=1.0)
        session.add(ass_item)
        await session.commit()

    # create attempt via service
    print('Creating attempt...')
    attempt_out = await create_attempt(CreateAttemptRequest(assessment_id=assessment.id, user_id=user.id))
    print('Attempt created:', attempt_out)

    # autosave
    print('Autosaving response...')
    ok = await autosave_attempt(attempt_out.id, AutosaveRequest(responses={str(item.id): '4'}))
    print('Autosave ok:', ok)

    # submit
    print('Submitting attempt...')
    submit_res = await submit_attempt(attempt_out.id)
    print('Submit result:', submit_res)

    # AGS sync (will attempt token exchange and likely fail against example.invalid)
    print('Running AGS sync (expected to record failure with fake token_url)...')
    ags_res = await ags_sync_attempt(attempt_out.id)
    print('AGS sync result:', ags_res)

if __name__ == '__main__':
    asyncio.run(main())
