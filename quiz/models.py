from django.db import models


class Participant(models.Model):
    name = models.CharField(max_length=100)
    emoji = models.CharField(max_length=10)
    score = models.IntegerField(default=0)
    total_questions = models.IntegerField(default=0)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    time_taken = models.IntegerField(default=0)  # seconds

    def percentage(self):
        if self.total_questions == 0:
            return 0
        return round((self.score / self.total_questions) * 100)

    def __str__(self):
        return f"{self.emoji} {self.name} — {self.score}/{self.total_questions}"

    class Meta:
        ordering = ['-score', 'time_taken']




class Question(models.Model):
    text = models.CharField(max_length=500)
    def __str__(self):
        return self.text

class Choice(models.Model):
    question = models.ForeignKey(Question, related_name="choices", on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)  # yoki default=0
    is_correct = models.BooleanField(default=False)