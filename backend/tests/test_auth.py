from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_user


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


def test_two_users_have_separate_identities():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as alice_client, TestClient(app) as bob_client:
        alice = register_user(alice_client, email="a@example.com", name="A")
        bob = register_user(bob_client, email="b@example.com", name="B")
        assert alice_client.get("/api/v1/auth/me").json()["email"] == "a@example.com"
        assert bob_client.get("/api/v1/auth/me").json()["email"] == "b@example.com"
        assert alice["id"] != bob["id"]
