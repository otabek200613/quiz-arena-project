from django.contrib import admin
from .models import Participant,Choice,Question

@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ['emoji', 'name', 'score', 'total_questions', 'completed', 'time_taken', 'created_at']
    list_filter = ['completed']
    ordering = ['-score', 'time_taken']


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "text")
    inlines = [ChoiceInline]