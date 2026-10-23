from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf_token, name="api-csrf"),
    path("login/", views.login, name="api-login"),
    path("me/", views.me, name="api-me"),
    path("logout/", views.logout, name="api-logout"),
]
