def test_health_endpoint(api_client):
    response = api_client.get("/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_root_endpoint(api_client):
    response = api_client.get("/")
    assert response.status_code == 200


def test_register_user(api_client):
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Test User",
            "email": "apitest@example.com",
            "password": "testpass123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email(api_client):
    api_client.post(
        "/users/register",
        json={
            "full_name": "Test User",
            "email": "dup@example.com",
            "password": "testpass123",
        },
    )
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Test User",
            "email": "dup@example.com",
            "password": "testpass123",
        },
    )
    assert response.status_code == 400


def test_login_user(api_client):
    api_client.post(
        "/users/register",
        json={
            "full_name": "Login User",
            "email": "login@example.com",
            "password": "testpass123",
        },
    )
    response = api_client.post(
        "/users/login",
        data={"username": "login@example.com", "password": "testpass123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(api_client):
    api_client.post(
        "/users/register",
        json={
            "full_name": "Wrong Pass",
            "email": "wrong@example.com",
            "password": "correctpass",
        },
    )
    response = api_client.post(
        "/users/login",
        data={"username": "wrong@example.com", "password": "wrongpass"},
    )
    assert response.status_code == 401


def test_products_requires_auth(api_client):
    response = api_client.get("/products/?shop=test.myshopify.com")
    assert response.status_code == 401


def test_ai_endpoints_require_auth(api_client):
    response = api_client.post("/ai/describe", json={"title": "Test"})
    assert response.status_code == 401


def test_protected_route_with_invalid_token(api_client):
    response = api_client.get(
        "/products/?shop=test.myshopify.com",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_webhook_for_unknown_store(api_client):
    response = api_client.post(
        "/webhooks/shopify",
        headers={"X-Shopify-Shop-Domain": "unknown.myshopify.com"},
        json={"test": True},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_get_me(api_client):
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Me User",
            "email": "me@example.com",
            "password": "testpass123",
        },
    )
    token = response.json()["access_token"]

    me = api_client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "me@example.com"


def test_update_me(api_client):
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Old Name",
            "email": "update@example.com",
            "password": "testpass123",
        },
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    updated = api_client.put(
        "/users/me",
        json={"full_name": "New Name"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "New Name"


def test_change_password(api_client):
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Pass User",
            "email": "pass@example.com",
            "password": "oldpass123",
        },
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    changed = api_client.put(
        "/users/me/password",
        json={"current_password": "oldpass123", "new_password": "newpass123"},
        headers=headers,
    )
    assert changed.status_code == 200

    login = api_client.post(
        "/users/login",
        data={"username": "pass@example.com", "password": "newpass123"},
    )
    assert login.status_code == 200


def test_change_password_wrong_current(api_client):
    response = api_client.post(
        "/users/register",
        json={
            "full_name": "Bad Pass",
            "email": "badpass@example.com",
            "password": "oldpass123",
        },
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    changed = api_client.put(
        "/users/me/password",
        json={"current_password": "wrongpass", "new_password": "newpass123"},
        headers=headers,
    )
    assert changed.status_code == 400