from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('results/', views.results_page, name='results'),
    path('manage/', views.manage_page, name='manage'),

    # API endpoints
    path('api/start/', views.start_quiz, name='start_quiz'),
    path('api/question/', views.get_question, name='get_question'),
    path('api/answer/', views.submit_answer, name='submit_answer'),
    path('api/finish/', views.finish_quiz, name='finish_quiz'),
    path('api/results/', views.api_results, name='api_results'),
    path('api/reset/', views.reset_all, name='reset_all'),
    path('api/questions/', views.api_get_questions, name='api_get_questions'),
    path('api/questions/save/', views.api_save_questions, name='api_save_questions'),
]