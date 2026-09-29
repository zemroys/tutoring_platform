# Результаты опросника: сохранить свой, посмотреть свой, а админу увидеть все (это заявки).

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_role
from database import get_db

router = APIRouter()


@router.put("/me/quiz-result", response_model=schemas.QuizResultOut)
def save_quiz_result(
    data: schemas.QuizResultIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = db.query(models.QuizResult).filter(models.QuizResult.user_id == user.id).first()
    if result is None:
        result = models.QuizResult(user_id=user.id)
        db.add(result)
    # Прошёл опрос заново — старый результат заменяется новым
    result.items = [item.model_dump() for item in data.items]
    result.updated_at = datetime.now()
    db.commit()
    db.refresh(result)
    return result


@router.get("/me/quiz-result", response_model=Optional[schemas.QuizResultOut])
def get_quiz_result(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Если опрос не проходил, вернётся null
    return db.query(models.QuizResult).filter(models.QuizResult.user_id == user.id).first()


@router.get("/admin/quiz-results", response_model=list[schemas.QuizLeadOut])
def all_quiz_results(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    rows = (
        db.query(models.QuizResult, models.User)
        .join(models.User, models.User.id == models.QuizResult.user_id)
        .order_by(models.QuizResult.updated_at.desc())
        .all()
    )
    return [
        schemas.QuizLeadOut(
            items=result.items,
            updated_at=result.updated_at,
            user_id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
        )
        for result, user in rows
    ]
