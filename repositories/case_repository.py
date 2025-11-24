"""
Case Repository for Legal Advocate AI
Specialized repository for MyCase integration
"""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.database import Case
from repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class CaseRepository(BaseRepository[Case]):
    """
    Repository for Case model with specialized query methods

    Features:
    - Case management for MyCase integration
    - Filter by user, status, type
    - Case metadata tracking
    """

    def __init__(self, session: Session):
        super().__init__(Case, session)

    def get_by_case_number(self, case_number: str) -> Optional[Case]:
        """
        Get case by case number

        Args:
            case_number: Unique case number

        Returns:
            Case instance or None if not found
        """
        try:
            return self.session.query(Case).filter_by(
                case_number=case_number
            ).first()
        except Exception as e:
            logger.error(f"Error getting case by number {case_number}: {e}")
            raise

    def get_user_cases(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Case]:
        """
        Get all cases for a user

        Args:
            user_id: User identifier
            status: Optional status filter (active, closed, archived)

        Returns:
            List of user's cases
        """
        try:
            query = self.session.query(Case).filter_by(user_id=user_id)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Case.filing_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting cases for user {user_id}: {e}")
            raise

    def get_active_cases(self, user_id: str) -> List[Case]:
        """
        Get all active cases for a user

        Args:
            user_id: User identifier

        Returns:
            List of active cases
        """
        try:
            return self.session.query(Case).filter(
                and_(
                    Case.user_id == user_id,
                    Case.status == 'active'
                )
            ).order_by(Case.filing_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting active cases for user {user_id}: {e}")
            raise

    def get_by_type(
        self,
        user_id: str,
        case_type: str,
        status: Optional[str] = None
    ) -> List[Case]:
        """
        Get cases by type (family, civil, criminal, etc.)

        Args:
            user_id: User identifier
            case_type: Type of case
            status: Optional status filter

        Returns:
            List of matching cases
        """
        try:
            query = self.session.query(Case).filter(
                and_(
                    Case.user_id == user_id,
                    Case.case_type == case_type
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Case.filing_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting cases by type {case_type}: {e}")
            raise

    def create_or_update(self, case_number: str, **case_data) -> Case:
        """
        Create a new case or update existing one

        Args:
            case_number: Unique case number
            **case_data: Case field values

        Returns:
            Case instance (created or updated)
        """
        try:
            existing_case = self.get_by_case_number(case_number)

            if existing_case:
                # Update existing case
                for key, value in case_data.items():
                    if hasattr(existing_case, key):
                        setattr(existing_case, key, value)
                existing_case.updated_at = datetime.utcnow()
                self.session.commit()
                self.session.refresh(existing_case)
                logger.info(f"Updated case: {case_number}")
                return existing_case
            else:
                # Create new case
                case_data['case_number'] = case_number
                return self.create(**case_data)
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error creating/updating case {case_number}: {e}")
            raise

    def archive_case(self, case_number: str) -> Optional[Case]:
        """
        Archive a case

        Args:
            case_number: Case number

        Returns:
            Updated case or None if not found
        """
        try:
            case = self.get_by_case_number(case_number)
            if case:
                case.status = 'archived'
                case.updated_at = datetime.utcnow()
                self.session.commit()
                logger.info(f"Archived case: {case_number}")
            return case
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error archiving case {case_number}: {e}")
            raise

    def close_case(self, case_number: str) -> Optional[Case]:
        """
        Close a case

        Args:
            case_number: Case number

        Returns:
            Updated case or None if not found
        """
        try:
            case = self.get_by_case_number(case_number)
            if case:
                case.status = 'closed'
                case.updated_at = datetime.utcnow()
                self.session.commit()
                logger.info(f"Closed case: {case_number}")
            return case
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error closing case {case_number}: {e}")
            raise

    def reopen_case(self, case_number: str) -> Optional[Case]:
        """
        Reopen a closed/archived case

        Args:
            case_number: Case number

        Returns:
            Updated case or None if not found
        """
        try:
            case = self.get_by_case_number(case_number)
            if case:
                case.status = 'active'
                case.updated_at = datetime.utcnow()
                self.session.commit()
                logger.info(f"Reopened case: {case_number}")
            return case
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error reopening case {case_number}: {e}")
            raise

    def add_notes(self, case_number: str, notes: str, append: bool = True) -> Optional[Case]:
        """
        Add or update notes for a case

        Args:
            case_number: Case number
            notes: Notes to add
            append: If True, append to existing notes; if False, replace

        Returns:
            Updated case or None if not found
        """
        try:
            case = self.get_by_case_number(case_number)
            if case:
                if append and case.notes:
                    case.notes = f"{case.notes}\n\n{datetime.utcnow().isoformat()}: {notes}"
                else:
                    case.notes = notes
                case.updated_at = datetime.utcnow()
                self.session.commit()
                logger.info(f"Updated notes for case: {case_number}")
            return case
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error updating notes for case {case_number}: {e}")
            raise

    def search_cases(
        self,
        user_id: str,
        search_term: str,
        status: Optional[str] = None
    ) -> List[Case]:
        """
        Search cases by title, case number, or court name

        Args:
            user_id: User identifier
            search_term: Search term
            status: Optional status filter

        Returns:
            List of matching cases
        """
        try:
            search_pattern = f"%{search_term}%"
            query = self.session.query(Case).filter(
                and_(
                    Case.user_id == user_id,
                    or_(
                        Case.case_number.like(search_pattern),
                        Case.case_title.like(search_pattern),
                        Case.court_name.like(search_pattern)
                    )
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Case.updated_at.desc()).all()
        except Exception as e:
            logger.error(f"Error searching cases: {e}")
            raise

    def find_by_case_number(self, case_number: str) -> Optional[Case]:
        """
        Find case by case number (alias for get_by_case_number for API consistency)

        Args:
            case_number: Case number to find

        Returns:
            Case instance or None
        """
        return self.get_by_case_number(case_number)

    def count_deadlines(self, case_id: str) -> int:
        """
        Count deadlines associated with a case

        Args:
            case_id: Case ID

        Returns:
            Number of deadlines
        """
        from models.database import Deadline
        try:
            case = self.find_by_id(case_id)
            if not case:
                return 0
            return self.session.query(Deadline).filter_by(case_number=case.case_number).count()
        except Exception as e:
            logger.error(f"Error counting deadlines for case {case_id}: {e}")
            return 0

    def count_requests(self, case_id: str) -> int:
        """
        Count requests associated with a case

        Args:
            case_id: Case ID

        Returns:
            Number of requests
        """
        from models.database import Request
        try:
            case = self.find_by_id(case_id)
            if not case:
                return 0
            return self.session.query(Request).filter_by(case_number=case.case_number).count()
        except Exception as e:
            logger.error(f"Error counting requests for case {case_id}: {e}")
            return 0

    def count_alerts(self, case_id: str) -> int:
        """
        Count alerts associated with a case (via deadlines)

        Args:
            case_id: Case ID

        Returns:
            Number of alerts
        """
        from models.database import Alert, Deadline
        try:
            case = self.find_by_id(case_id)
            if not case:
                return 0
            # Get deadlines for this case, then count their alerts
            deadline_ids = [d.id for d in self.session.query(Deadline).filter_by(case_number=case.case_number).all()]
            if not deadline_ids:
                return 0
            return self.session.query(Alert).filter(Alert.deadline_id.in_(deadline_ids)).count()
        except Exception as e:
            logger.error(f"Error counting alerts for case {case_id}: {e}")
            return 0
