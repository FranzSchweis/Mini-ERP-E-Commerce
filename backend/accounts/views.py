import json

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST


SESSION_TIMEOUT_SECONDS = 5 * 60


def account_payload(user):
    return {
        "id": user.pk,
        "username": user.get_username(),
        "full_name": user.get_full_name() or user.get_username(),
        "email": user.email,
        "is_staff": user.is_staff,
    }


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
@csrf_protect
def login(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"detail": "Send a valid JSON request."}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"detail": "Send a valid JSON request."}, status=400)

    username = data.get("username", "")
    password = data.get("password", "")
    if not isinstance(username, str) or not isinstance(password, str) or not username.strip() or not password:
        return JsonResponse({"detail": "Enter your username and password."}, status=400)

    user = authenticate(request, username=username.strip(), password=password)
    if user is None:
        return JsonResponse({"detail": "The username or password is incorrect."}, status=401)

    auth_login(request, user)
    request.session.set_expiry(SESSION_TIMEOUT_SECONDS)
    return JsonResponse({"account": account_payload(user)})


@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    return JsonResponse(account_payload(request.user))


@require_POST
@csrf_protect
def logout(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    auth_logout(request)
    return HttpResponse(status=204)
