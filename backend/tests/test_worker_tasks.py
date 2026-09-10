import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base
from app.database.store_model import Store
from app.database.automation_models import AutomationRule
from app.worker.celery_app import celery_app
from app.worker import tasks


@pytest.fixture(scope="module", autouse=True)
def eager_celery():
    orig = dict(
        task_always_eager=celery_app.conf.task_always_eager,
        task_store_eager_result=celery_app.conf.task_store_eager_result,
        result_backend=celery_app.conf.result_backend,
    )
    celery_app.conf.update(
        task_always_eager=True,
        task_store_eager_result=True,
        result_backend="cache+memory://",
    )
    yield
    celery_app.conf.update(**orig)


@pytest.fixture
def task_db(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(tasks, "SessionLocal", lambda: TestSession())
    yield TestSession
    Base.metadata.drop_all(bind=engine)


def test_sync_products_task(task_db, monkeypatch):
    session = task_db()
    store_a = Store(shop_domain="a.myshopify.com", access_token="tok")
    store_b = Store(shop_domain="b.myshopify.com", access_token="tok")
    session.add_all([store_a, store_b])
    session.commit()
    store_a_id = store_a.id
    store_b_id = store_b.id
    session.close()

    called = []

    def fake_sync(db, store_id):
        called.append(store_id)
        return {"synced": 2, "total": 3}

    monkeypatch.setattr(tasks, "sync_products", fake_sync)

    result = tasks.sync_products_task.apply().get()

    assert called == [store_a_id, store_b_id]
    assert [r["synced"] for r in result["results"]] == [2, 2]


def test_sync_products_task_single_store(task_db, monkeypatch):
    session = task_db()
    store_a = Store(shop_domain="a.myshopify.com", access_token="tok")
    store_b = Store(shop_domain="b.myshopify.com", access_token="tok")
    session.add_all([store_a, store_b])
    session.commit()
    store_a_id = store_a.id
    session.close()

    called = []

    def fake_sync(db, store_id):
        called.append(store_id)
        return {"synced": 1, "total": 1}

    monkeypatch.setattr(tasks, "sync_products", fake_sync)

    result = tasks.sync_products_task.apply(kwargs={"store_id": store_a_id}).get()

    assert called == [store_a_id]
    assert len(result["results"]) == 1


def test_run_automation_rules_task_filters(task_db, monkeypatch):
    session = task_db()
    store = Store(shop_domain="x.myshopify.com", access_token="t")
    session.add(store)
    session.commit()

    enabled_auto = AutomationRule(
        store_id=store.id, name="Auto", rule_type="auto_fulfill", enabled=True
    )
    enabled_rep = AutomationRule(
        store_id=store.id, name="Reprice", rule_type="repricing", enabled=True
    )
    disabled = AutomationRule(
        store_id=store.id, name="Off", rule_type="low_stock", enabled=False
    )
    session.add_all([enabled_auto, enabled_rep, disabled])
    session.commit()
    session.close()

    run_types = []

    def fake_run(db, store_, rule):
        run_types.append(rule.rule_type)
        return {"status": "success", "count": 1, "error": None, "summary": "ok"}

    monkeypatch.setattr(tasks, "run_rule_now", fake_run)

    filtered = tasks.run_automation_rules_task.apply(
        kwargs={"rule_type": "auto_fulfill"}
    ).get()
    assert run_types == ["auto_fulfill"]
    assert [r["status"] for r in filtered["results"]] == ["success"]

    run_types.clear()
    tasks.run_automation_rules_task.apply().get()
    assert sorted(run_types) == ["auto_fulfill", "repricing"]


def test_run_automation_rules_task_captures_errors(task_db, monkeypatch):
    session = task_db()
    store = Store(shop_domain="x.myshopify.com", access_token="t")
    session.add(store)
    session.commit()
    session.add(
        AutomationRule(
            store_id=store.id, name="Auto", rule_type="auto_fulfill", enabled=True
        )
    )
    session.commit()
    session.close()

    def boom(db, store_, rule):
        raise RuntimeError("boom")

    monkeypatch.setattr(tasks, "run_rule_now", boom)

    result = tasks.run_automation_rules_task.apply().get()

    assert len(result["results"]) == 1
    entry = result["results"][0]
    assert entry["status"] == "error"
    assert entry["error"] == "boom"


def test_deliver_pending_notifications_task(task_db, monkeypatch):
    session = task_db()
    store = Store(shop_domain="y.myshopify.com", access_token="t")
    session.add(store)
    session.commit()
    store_id = store.id
    session.close()

    called = []

    def fake_deliver(db, store_id):
        called.append(store_id)
        return {"count": 2, "results": []}

    monkeypatch.setattr(tasks, "deliver_pending", fake_deliver)

    result = tasks.deliver_pending_notifications_task.apply().get()

    assert called == [store_id]
    assert result["results"][0]["count"] == 2