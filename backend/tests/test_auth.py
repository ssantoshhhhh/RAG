from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_user


def request_reset_link(client: TestClient, email: str = "alice@example.com") -> str:
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email},
        headers=csrf_headers(client),
    )
    assert response.status_code == 202, response.text
    reset_url = response.json()["reset_url"]
    assert reset_url
    return parse_qs(urlparse(reset_url).query)["token"][0]


def test_register_sets_secure_cookies_and_returns_user(client: TestClient):
    user = register_user(client)
    assert user["email"] == "alice@example.com"
    assert "password" not in user and "password_hash" not in user
    assert client.cookies.get("dm_access")
    assert client.cookies.get("dm_refresh")
    assert client.cookies.get("dm_csrf")


def test_duplicate_email_is_rejected(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "ALICE@example.com", "password": "Password123", "name": "Dup"},
    )
    assert response.status_code == 409


def test_weak_password_is_rejected(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak@example.com", "password": "password", "name": "Weak"},
    )
    assert response.status_code == 422


def test_login_logout_and_me(client: TestClient):
    register_user(client)
    response = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "Password123"},
    )
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").json()["name"] == "Alice"


def test_login_with_wrong_password_fails(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "WrongPass123"},
    )
    assert response.status_code == 401


def test_refresh_rotates_tokens(client: TestClient):
    register_user(client)
    old_access = client.cookies.get("dm_access")
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert client.cookies.get("dm_access")
    assert client.cookies.get("dm_access") != old_access
    assert client.get("/api/v1/auth/me").status_code == 200


def test_refresh_without_cookie_fails(client: TestClient):
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_csrf_required_for_mutations(client: TestClient):
    register_user(client)
    response = client.post("/api/v1/conversations", json={})
    assert response.status_code == 403
    assert "CSRF" in response.json()["detail"]

    response = client.post("/api/v1/conversations", json={}, headers=csrf_headers(client))
    assert response.status_code == 201


def test_csrf_header_mismatch_is_rejected(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/conversations",
        json={},
        headers={"X-CSRF-Token": "wrong-token"},
    )
    assert response.status_code == 403


def test_disallowed_origin_is_rejected(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/conversations",
        json={},
        headers={**csrf_headers(client), "Origin": "http://evil.example"},
    )
    assert response.status_code == 403


def test_unauthenticated_access_returns_401(client: TestClient):
    for path in ("/api/v1/auth/me", "/api/v1/documents", "/api/v1/conversations"):
        assert client.get(path).status_code == 401


def test_forgot_password_returns_dev_reset_link(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "alice@example.com"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 202
    body = response.json()
    assert "reset" in body["message"].lower()
    assert "/reset-password?token=" in body["reset_url"]


def test_forgot_password_unknown_email_is_generic(client: TestClient):
    response = client.post(
        "/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}
    )
    assert response.status_code == 202
    body = response.json()
    assert body["reset_url"] is None
    assert "if an account exists" in body["message"].lower()


def test_forgot_password_hides_link_in_production(client: TestClient, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    register_user(client)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "alice@example.com"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 202
    assert response.json()["reset_url"] is None


def test_forgot_password_reveals_link_to_trusted_internal_caller(client: TestClient, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    register_user(client)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "alice@example.com"},
        headers={**csrf_headers(client), "X-Internal-Key": "internal-secret"},
    )
    assert response.status_code == 202
    assert response.json()["reset_url"]


def test_reset_password_flow(client: TestClient):
    register_user(client)
    token = request_reset_link(client)

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "BrandNew123"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "Password123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "BrandNew123"},
    )
    assert new_login.status_code == 200


def test_reset_password_rejects_invalid_token(client: TestClient):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "not-a-real-token-value", "password": "BrandNew123"},
    )
    assert response.status_code == 400


def test_reset_token_is_single_use(client: TestClient):
    register_user(client)
    token = request_reset_link(client)

    first = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "BrandNew123"},
        headers=csrf_headers(client),
    )
    assert first.status_code == 204

    second = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "AnotherPass123"},
    )
    assert second.status_code == 400


def test_new_reset_request_invalidates_previous_token(client: TestClient):
    register_user(client)
    first_token = request_reset_link(client)
    second_token = request_reset_link(client)
    assert first_token != second_token

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": first_token, "password": "BrandNew123"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 400


def test_reset_password_enforces_strength(client: TestClient):
    register_user(client)
    token = request_reset_link(client)
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "password"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 422


def test_two_users_have_separate_identities():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as alice_client, TestClient(app) as bob_client:
        alice = register_user(alice_client, email="a@example.com", name="A")
        bob = register_user(bob_client, email="b@example.com", name="B")
        assert alice_client.get("/api/v1/auth/me").json()["email"] == "a@example.com"
        assert bob_client.get("/api/v1/auth/me").json()["email"] == "b@example.com"
        assert alice["id"] != bob["id"]
