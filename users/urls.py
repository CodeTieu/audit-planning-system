"""Users app URL routing."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────
    path('auth/login/',           views.LoginView.as_view(),           name='login'),
    path('auth/logout/',          views.LogoutView.as_view(),          name='logout'),
    path('auth/token/refresh/',   TokenRefreshView.as_view(),          name='token_refresh'),
    path('auth/change-password/', views.ChangePasswordView.as_view(),  name='change_password'),
    path('auth/heartbeat/',       views.SessionHeartbeatView.as_view(),name='heartbeat'),

    # ── Users ─────────────────────────────────────────────────
    path('users/',                views.UserListCreateView.as_view(),  name='user_list'),
    path('users/me/',             views.UserProfileView.as_view(),     name='user_me'),
    path('users/by-role/',        views.users_by_role,                 name='users_by_role'),
    path('users/<int:pk>/',       views.UserDetailView.as_view(),      name='user_detail'),
    path('users/<int:pk>/unlock/',views.unlock_user,                   name='unlock_user'),
    path('users/<int:pk>/lock/',  views.lock_user,                     name='lock_user'),
    path('users/<int:pk>/offline/',views.toggle_offline,               name='toggle_offline'),
    path('users/<int:user_id>/roles/', views.manage_additional_role,   name='user_roles'),

    # ── Supervision ───────────────────────────────────────────
    path('supervision/',          views.SupervisionLinkListCreateView.as_view(),
         name='supervision_list'),
    path('supervision/mine/',     views.my_supervised_users,           name='my_supervised'),
    path('supervision/<int:pk>/', views.delete_supervision_link,       name='supervision_delete'),

    # ── Divisions ─────────────────────────────────────────────
    path('divisions/',            views.DivisionListCreateView.as_view(), name='division_list'),
    path('divisions/<int:pk>/',   views.DivisionDetailView.as_view(),     name='division_detail'),
]
