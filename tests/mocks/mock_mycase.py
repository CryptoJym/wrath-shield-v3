"""
Mock MyCase API responses for testing
"""

from typing import List, Dict, Optional
from datetime import datetime
import json


class MockMyCaseAPI:
    """Mock MyCase API for testing"""

    def __init__(self):
        self.cases = []
        self.contacts = []
        self.events = []
        self.tasks = []
        self.documents = []
        self.api_calls = []  # Track API calls for testing

    def _log_call(self, method: str, endpoint: str, **kwargs):
        """Log API call for verification in tests"""
        self.api_calls.append({
            "method": method,
            "endpoint": endpoint,
            "timestamp": datetime.now(),
            **kwargs
        })

    def add_case(self, case_data: Dict) -> Dict:
        """Add a mock case"""
        case = {
            "id": len(self.cases) + 1,
            "number": case_data.get("number", f"CASE-{len(self.cases) + 1:04d}"),
            "name": case_data.get("name", "Test Case"),
            "description": case_data.get("description", ""),
            "status": case_data.get("status", "Open"),
            "practice_area": case_data.get("practice_area", "General"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            **case_data
        }
        self.cases.append(case)
        return case

    def add_contact(self, contact_data: Dict) -> Dict:
        """Add a mock contact"""
        contact = {
            "id": len(self.contacts) + 1,
            "type": contact_data.get("type", "Individual"),
            "first_name": contact_data.get("first_name", "John"),
            "last_name": contact_data.get("last_name", "Doe"),
            "email": contact_data.get("email", "john@example.com"),
            "phone": contact_data.get("phone", "555-1234"),
            "created_at": datetime.now().isoformat(),
            **contact_data
        }
        self.contacts.append(contact)
        return contact

    def add_event(self, event_data: Dict) -> Dict:
        """Add a mock calendar event"""
        event = {
            "id": len(self.events) + 1,
            "case_id": event_data.get("case_id"),
            "title": event_data.get("title", "Event"),
            "description": event_data.get("description", ""),
            "start_time": event_data.get("start_time", datetime.now().isoformat()),
            "end_time": event_data.get("end_time"),
            "location": event_data.get("location", ""),
            "event_type": event_data.get("event_type", "Other"),
            "created_at": datetime.now().isoformat(),
            **event_data
        }
        self.events.append(event)
        return event

    def add_task(self, task_data: Dict) -> Dict:
        """Add a mock task"""
        task = {
            "id": len(self.tasks) + 1,
            "case_id": task_data.get("case_id"),
            "title": task_data.get("title", "Task"),
            "description": task_data.get("description", ""),
            "due_date": task_data.get("due_date"),
            "priority": task_data.get("priority", "Medium"),
            "status": task_data.get("status", "Pending"),
            "assigned_to": task_data.get("assigned_to"),
            "created_at": datetime.now().isoformat(),
            **task_data
        }
        self.tasks.append(task)
        return task

    def get_cases(self, filters: Dict = None) -> List[Dict]:
        """Mock GET /cases endpoint"""
        self._log_call("GET", "/cases", filters=filters)

        cases = self.cases.copy()

        if filters:
            if "status" in filters:
                cases = [c for c in cases if c["status"] == filters["status"]]
            if "practice_area" in filters:
                cases = [c for c in cases if c["practice_area"] == filters["practice_area"]]

        return cases

    def get_case(self, case_id: int) -> Optional[Dict]:
        """Mock GET /cases/{id} endpoint"""
        self._log_call("GET", f"/cases/{case_id}")

        case = next((c for c in self.cases if c["id"] == case_id), None)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        return case

    def create_case(self, case_data: Dict) -> Dict:
        """Mock POST /cases endpoint"""
        self._log_call("POST", "/cases", data=case_data)
        return self.add_case(case_data)

    def update_case(self, case_id: int, case_data: Dict) -> Dict:
        """Mock PUT /cases/{id} endpoint"""
        self._log_call("PUT", f"/cases/{case_id}", data=case_data)

        case = next((c for c in self.cases if c["id"] == case_id), None)
        if not case:
            raise ValueError(f"Case {case_id} not found")

        case.update(case_data)
        case["updated_at"] = datetime.now().isoformat()
        return case

    def get_contacts(self, filters: Dict = None) -> List[Dict]:
        """Mock GET /contacts endpoint"""
        self._log_call("GET", "/contacts", filters=filters)

        contacts = self.contacts.copy()

        if filters:
            if "type" in filters:
                contacts = [c for c in contacts if c["type"] == filters["type"]]
            if "email" in filters:
                contacts = [c for c in contacts if filters["email"] in c.get("email", "")]

        return contacts

    def get_contact(self, contact_id: int) -> Optional[Dict]:
        """Mock GET /contacts/{id} endpoint"""
        self._log_call("GET", f"/contacts/{contact_id}")

        contact = next((c for c in self.contacts if c["id"] == contact_id), None)
        if not contact:
            raise ValueError(f"Contact {contact_id} not found")
        return contact

    def create_contact(self, contact_data: Dict) -> Dict:
        """Mock POST /contacts endpoint"""
        self._log_call("POST", "/contacts", data=contact_data)
        return self.add_contact(contact_data)

    def get_events(self, filters: Dict = None) -> List[Dict]:
        """Mock GET /events endpoint"""
        self._log_call("GET", "/events", filters=filters)

        events = self.events.copy()

        if filters:
            if "case_id" in filters:
                events = [e for e in events if e.get("case_id") == filters["case_id"]]
            if "event_type" in filters:
                events = [e for e in events if e["event_type"] == filters["event_type"]]

        return events

    def create_event(self, event_data: Dict) -> Dict:
        """Mock POST /events endpoint"""
        self._log_call("POST", "/events", data=event_data)
        return self.add_event(event_data)

    def get_tasks(self, filters: Dict = None) -> List[Dict]:
        """Mock GET /tasks endpoint"""
        self._log_call("GET", "/tasks", filters=filters)

        tasks = self.tasks.copy()

        if filters:
            if "case_id" in filters:
                tasks = [t for t in tasks if t.get("case_id") == filters["case_id"]]
            if "status" in filters:
                tasks = [t for t in tasks if t["status"] == filters["status"]]
            if "assigned_to" in filters:
                tasks = [t for t in tasks if t.get("assigned_to") == filters["assigned_to"]]

        return tasks

    def create_task(self, task_data: Dict) -> Dict:
        """Mock POST /tasks endpoint"""
        self._log_call("POST", "/tasks", data=task_data)
        return self.add_task(task_data)

    def update_task(self, task_id: int, task_data: Dict) -> Dict:
        """Mock PUT /tasks/{id} endpoint"""
        self._log_call("PUT", f"/tasks/{task_id}", data=task_data)

        task = next((t for t in self.tasks if t["id"] == task_id), None)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task.update(task_data)
        return task

    def upload_document(self, document_data: Dict, file_content: bytes = None) -> Dict:
        """Mock POST /documents endpoint"""
        self._log_call("POST", "/documents", data=document_data)

        document = {
            "id": len(self.documents) + 1,
            "case_id": document_data.get("case_id"),
            "name": document_data.get("name", "document.pdf"),
            "document_type": document_data.get("document_type", "Other"),
            "file_size": len(file_content) if file_content else 0,
            "uploaded_at": datetime.now().isoformat(),
            **document_data
        }
        self.documents.append(document)
        return document

    def get_case_timeline(self, case_id: int) -> List[Dict]:
        """Mock GET /cases/{id}/timeline endpoint"""
        self._log_call("GET", f"/cases/{case_id}/timeline")

        # Combine all activities for this case
        timeline = []

        # Add case events
        for event in self.events:
            if event.get("case_id") == case_id:
                timeline.append({
                    "type": "event",
                    "timestamp": event["start_time"],
                    "description": event["title"],
                    "data": event
                })

        # Add tasks
        for task in self.tasks:
            if task.get("case_id") == case_id:
                timeline.append({
                    "type": "task",
                    "timestamp": task["created_at"],
                    "description": task["title"],
                    "data": task
                })

        # Add documents
        for doc in self.documents:
            if doc.get("case_id") == case_id:
                timeline.append({
                    "type": "document",
                    "timestamp": doc["uploaded_at"],
                    "description": f"Document uploaded: {doc['name']}",
                    "data": doc
                })

        # Sort by timestamp
        timeline.sort(key=lambda x: x["timestamp"], reverse=True)
        return timeline

    def clear_all(self):
        """Clear all mock data"""
        self.cases = []
        self.contacts = []
        self.events = []
        self.tasks = []
        self.documents = []
        self.api_calls = []


def create_mock_mycase_client():
    """Factory function to create mock MyCase API client"""
    return MockMyCaseAPI()
