"""
Base Repository Pattern for Legal Advocate AI
Provides generic CRUD operations and transaction management
"""

from typing import TypeVar, Generic, List, Optional, Dict, Any, Type
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Generic type for database models
ModelType = TypeVar('ModelType')


class BaseRepository(Generic[ModelType]):
    """
    Generic repository providing CRUD operations for any SQLAlchemy model

    Features:
    - Create, Read, Update, Delete operations
    - Bulk operations
    - Transaction management with automatic rollback
    - Error handling and logging
    - Flexible filtering and sorting
    """

    def __init__(self, model: Type[ModelType], session: Session):
        """
        Initialize repository

        Args:
            model: SQLAlchemy model class
            session: Database session
        """
        self.model = model
        self.session = session

    def create(self, **kwargs) -> ModelType:
        """
        Create a new record

        Args:
            **kwargs: Field values for the new record

        Returns:
            Created model instance

        Raises:
            SQLAlchemyError: If creation fails
        """
        try:
            instance = self.model(**kwargs)
            self.session.add(instance)
            self.session.commit()
            self.session.refresh(instance)
            logger.info(f"Created {self.model.__name__}: {instance.id}")
            return instance
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Error creating {self.model.__name__}: {e}")
            raise

    def get_by_id(self, id: str) -> Optional[ModelType]:
        """
        Get record by ID

        Args:
            id: Record ID

        Returns:
            Model instance or None if not found
        """
        try:
            return self.session.query(self.model).filter_by(id=id).first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching {self.model.__name__} by id {id}: {e}")
            raise

    def get_all(self, limit: Optional[int] = None, offset: int = 0) -> List[ModelType]:
        """
        Get all records with optional pagination

        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip

        Returns:
            List of model instances
        """
        try:
            query = self.session.query(self.model)
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            return query.all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all {self.model.__name__}: {e}")
            raise

    def filter_by(self, limit: Optional[int] = None, offset: Optional[int] = None, **filters) -> List[ModelType]:
        """
        Filter records by field values

        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip
            **filters: Field name and value pairs

        Returns:
            List of matching model instances
        """
        try:
            query = self.session.query(self.model).filter_by(**filters)
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            return query.all()
        except SQLAlchemyError as e:
            logger.error(f"Error filtering {self.model.__name__}: {e}")
            raise

    def update(self, id: str, **updates) -> Optional[ModelType]:
        """
        Update a record

        Args:
            id: Record ID
            **updates: Fields to update with new values

        Returns:
            Updated model instance or None if not found

        Raises:
            SQLAlchemyError: If update fails
        """
        try:
            instance = self.get_by_id(id)
            if instance is None:
                logger.warning(f"{self.model.__name__} with id {id} not found for update")
                return None

            for key, value in updates.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)

            self.session.commit()
            self.session.refresh(instance)
            logger.info(f"Updated {self.model.__name__}: {id}")
            return instance
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Error updating {self.model.__name__} {id}: {e}")
            raise

    def delete(self, id: str) -> bool:
        """
        Delete a record

        Args:
            id: Record ID

        Returns:
            True if deleted, False if not found

        Raises:
            SQLAlchemyError: If deletion fails
        """
        try:
            instance = self.get_by_id(id)
            if instance is None:
                logger.warning(f"{self.model.__name__} with id {id} not found for deletion")
                return False

            self.session.delete(instance)
            self.session.commit()
            logger.info(f"Deleted {self.model.__name__}: {id}")
            return True
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Error deleting {self.model.__name__} {id}: {e}")
            raise

    def bulk_create(self, records: List[Dict[str, Any]]) -> List[ModelType]:
        """
        Create multiple records in one transaction

        Args:
            records: List of dictionaries with field values

        Returns:
            List of created model instances

        Raises:
            SQLAlchemyError: If any creation fails (all rolled back)
        """
        try:
            instances = [self.model(**record) for record in records]
            self.session.bulk_save_objects(instances, return_defaults=True)
            self.session.commit()
            logger.info(f"Bulk created {len(instances)} {self.model.__name__} records")
            return instances
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Error bulk creating {self.model.__name__}: {e}")
            raise

    def count(self, **filters) -> int:
        """
        Count records matching filters

        Args:
            **filters: Field name and value pairs

        Returns:
            Number of matching records
        """
        try:
            query = self.session.query(self.model)
            if filters:
                query = query.filter_by(**filters)
            return query.count()
        except SQLAlchemyError as e:
            logger.error(f"Error counting {self.model.__name__}: {e}")
            raise

    def exists(self, **filters) -> bool:
        """
        Check if a record exists matching filters

        Args:
            **filters: Field name and value pairs

        Returns:
            True if at least one record exists
        """
        return self.count(**filters) > 0
