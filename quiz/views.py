import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Prefetch

from .models import Participant, Question, Choice


def _questions_qs():
    # savollarni doim bir xil tartibda berish uchun order_by qo'ydik
    return Question.objects.prefetch_related(
        Prefetch("choices", queryset=Choice.objects.order_by("id"))
    ).order_by("id")


def _question_count():
    return Question.objects.count()


from django.shortcuts import render
from django.db.models import Prefetch
from .models import Question, Choice

def index(request):
    qs = Question.objects.prefetch_related(
        Prefetch("choices", queryset=Choice.objects.order_by("id"))
    ).order_by("id")

    # JS uchun tayyor format (sizdagi QUESTIONS kabi)
    questions_data = []
    for q in qs:
        choices = list(q.choices.all())
        options = [c.text for c in choices]

        correct_index = 0
        for i, c in enumerate(choices):
            if c.is_correct:
                correct_index = i
                break

        questions_data.append({
            "id": q.id,
            "q": q.text,
            "options": options,
            "answer": correct_index,
        })

    return render(request, "quiz/index.html", {
        "total_questions": len(questions_data),
        "questions_json": questions_data,   # <-- HTMLga yuboryapmiz
    })

def results_page(request):
    """Natijalar ko'rish sahifasi"""
    return render(request, 'quiz/results.html')
def manage_page(request):
    return render(request, "quiz/manage.html")

@csrf_exempt
@require_http_methods(["POST"])
def start_quiz(request):
    """Ishtirokchi ro'yxatdan o'tishi"""
    data = json.loads(request.body)
    name = data.get('name', '').strip()[:100]
    emoji = data.get('emoji', '⭐')

    if not name:
        return JsonResponse({'error': 'Ism kiritilmadi'}, status=400)

    total = _question_count()

    participant = Participant.objects.create(
        name=name,
        emoji=emoji,
        total_questions=total
    )
    request.session['participant_id'] = participant.id
    return JsonResponse({'participant_id': participant.id, 'total': total})


def get_question(request):
    """Savol olish (DB dan)"""
    index = int(request.GET.get('index', 0))
    total = _question_count()

    if index < 0 or index >= total:
        return JsonResponse({'error': 'Savol topilmadi'}, status=404)

    q_obj = _questions_qs()[index]
    options = [c.text for c in q_obj.choices.all()]

    return JsonResponse({
        'index': index,
        'total': total,
        'question': q_obj.text,
        'options': options,
    })


@csrf_exempt
@require_http_methods(["POST"])
def submit_answer(request):
    """Javob yuborish (DB dan to'g'ri javobni tekshiradi)"""
    data = json.loads(request.body)
    participant_id = data.get('participant_id')
    q_index = data.get('question_index')
    selected = data.get('selected')

    if q_index is None or selected is None:
        return JsonResponse({'error': 'Noto‘g‘ri so‘rov (question_index/selected yo‘q)'}, status=400)

    try:
        participant = Participant.objects.get(id=participant_id)
    except Participant.DoesNotExist:
        return JsonResponse({'error': 'Ishtirokchi topilmadi'}, status=404)

    total = _question_count()
    if q_index < 0 or q_index >= total:
        return JsonResponse({'error': 'Savol topilmadi'}, status=404)

    q_obj = _questions_qs()[q_index]
    choices = list(q_obj.choices.all())

    # To'g'ri javobni topamiz
    correct_idx = None
    for i, c in enumerate(choices):
        if c.is_correct:
            correct_idx = i
            break

    if correct_idx is None:
        return JsonResponse({'error': 'To‘g‘ri javob belgilanmagan (admin panelda is_correct yoqilmagan)'}, status=500)

    is_correct = (selected == correct_idx)

    if is_correct:
        participant.score += 1
        participant.save(update_fields=["score"])

    return JsonResponse({
        'correct': is_correct,
        'correct_index': correct_idx,
        'score': participant.score,
    })


@csrf_exempt
@require_http_methods(["POST"])
def finish_quiz(request):
    """Testni tugatish"""
    data = json.loads(request.body)
    participant_id = data.get('participant_id')
    time_taken = data.get('time_taken', 0)

    try:
        participant = Participant.objects.get(id=participant_id)
        participant.completed = True
        participant.finished_at = timezone.now()
        participant.time_taken = time_taken
        participant.save()
    except Participant.DoesNotExist:
        pass

    return JsonResponse({'status': 'ok'})


from django.db.models.functions import Coalesce
from django.db.models import Value, IntegerField
from .models import Participant, Question

def api_results(request):
    # DB dagi savollar soni (diagramma uchun eng to‘g‘ri manba)
    question_count = Question.objects.count()

    # Hamma ishtirokchilarni chiqaramiz (tugatgan + ishlayotgan)
    # time_taken null bo‘lsa 999999 qilib turamiz, sorting buzilmasin
    participants_qs = Participant.objects.annotate(
        time_sort=Coalesce('time_taken', Value(999999), output_field=IntegerField())
    ).order_by('-score', 'time_sort')

    completed_count = Participant.objects.filter(completed=True).count()
    active_count = Participant.objects.filter(completed=False).count()

    data = []
    for rank, p in enumerate(participants_qs, 1):
        # agar p.total_questions eski bo‘lsa ham, DB dagi count bilan “to‘g‘rilab” ko‘rsatamiz
        total = question_count or p.total_questions or 0

        data.append({
            'rank': rank,
            'id': p.id,
            'name': p.name,
            'emoji': p.emoji,
            'score': p.score,
            'total': total,
            'percentage': round((p.score / total) * 100) if total else 0,
            'time_taken': p.time_taken,
            'finished_at': p.finished_at.isoformat() if p.finished_at else None,
            'completed': p.completed,
        })

    return JsonResponse({
        'participants': data,
        'total_participants': Participant.objects.count(),
        'completed_count': completed_count,
        'active_count': active_count,
        'question_count': question_count,
    })
def api_get_questions(request):
    qs = _questions_qs()

    questions = []
    for q in qs:
        choices = list(q.choices.all())
        options = [c.text for c in choices]

        correct_index = 0
        for i, c in enumerate(choices):
            if c.is_correct:
                correct_index = i
                break

        questions.append({
            "q": q.text,
            "options": options,
            "answer": correct_index,
        })

    return JsonResponse({"questions": questions})
@csrf_exempt
@require_http_methods(["POST"])
def api_save_questions(request):
    data = json.loads(request.body)
    questions = data.get("questions", [])

    # Eski savollarni tozalaymiz (eng sodda usul)
    # (Choice lar ForeignKey bilan CASCADE bo‘lsa o‘zi o‘chadi)
    Question.objects.all().delete()

    for item in questions:
        q_text = (item.get("q") or "").strip()
        opts = item.get("options") or []
        ans = item.get("answer", 0)

        if not q_text or len(opts) != 4:
            continue

        q_obj = Question.objects.create(text=q_text)

        for i, opt_text in enumerate(opts):
            Choice.objects.create(
                question=q_obj,
                text=str(opt_text).strip(),
                is_correct=(i == int(ans)),
            )

    return JsonResponse({"status": "ok"})
@csrf_exempt
@require_http_methods(["POST"])
def reset_all(request):
    """Barcha natijalarni o'chirish (admin uchun)"""
    Participant.objects.all().delete()
    return JsonResponse({'status': 'reset'})