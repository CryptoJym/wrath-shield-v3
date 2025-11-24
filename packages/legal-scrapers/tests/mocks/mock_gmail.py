"""
Mock Gmail API responses for testing
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import base64
import json


class MockGmailAPI:
    """Mock Gmail API for testing without real API calls"""

    def __init__(self):
        self.messages = []
        self.labels = [
            {"id": "INBOX", "name": "INBOX"},
            {"id": "IMPORTANT", "name": "IMPORTANT"},
            {"id": "STARRED", "name": "STARRED"},
            {"id": "Label_001", "name": "Attorney Requests"},
            {"id": "Label_002", "name": "Urgent"}
        ]
        self.sent_messages = []

    def add_message(
        self,
        subject: str,
        from_email: str,
        to_email: str,
        body: str,
        labels: List[str] = None,
        thread_id: str = None,
        date: datetime = None,
        attachments: List[Dict] = None
    ) -> str:
        """Add a mock message to the inbox"""
        msg_id = f"msg_{len(self.messages) + 1:05d}"
        thread_id = thread_id or f"thread_{len(self.messages) + 1:05d}"
        date = date or datetime.now()
        labels = labels or ["INBOX"]
        attachments = attachments or []

        message = {
            "id": msg_id,
            "threadId": thread_id,
            "labelIds": labels,
            "snippet": body[:100] + "..." if len(body) > 100 else body,
            "internalDate": str(int(date.timestamp() * 1000)),
            "payload": {
                "headers": [
                    {"name": "From", "value": from_email},
                    {"name": "To", "value": to_email},
                    {"name": "Subject", "value": subject},
                    {"name": "Date", "value": date.strftime("%a, %d %b %Y %H:%M:%S %z")}
                ],
                "body": {
                    "data": base64.urlsafe_b64encode(body.encode()).decode()
                },
                "parts": self._create_parts(body, attachments)
            }
        }

        self.messages.append(message)
        return msg_id

    def _create_parts(self, body: str, attachments: List[Dict]) -> List[Dict]:
        """Create message parts for body and attachments"""
        parts = [
            {
                "mimeType": "text/plain",
                "body": {
                    "data": base64.urlsafe_b64encode(body.encode()).decode()
                }
            }
        ]

        for attachment in attachments:
            parts.append({
                "filename": attachment.get("filename", "document.pdf"),
                "mimeType": attachment.get("mime_type", "application/pdf"),
                "body": {
                    "attachmentId": f"att_{len(parts)}",
                    "size": attachment.get("size", 0)
                }
            })

        return parts

    def users_messages_list(
        self,
        userId: str = "me",
        q: str = None,
        labelIds: List[str] = None,
        maxResults: int = 100,
        pageToken: str = None
    ) -> Dict:
        """Mock messages.list() API call"""
        filtered_messages = self.messages.copy()

        # Apply query filter
        if q:
            filtered_messages = [
                msg for msg in filtered_messages
                if self._matches_query(msg, q)
            ]

        # Apply label filter
        if labelIds:
            filtered_messages = [
                msg for msg in filtered_messages
                if any(label in msg["labelIds"] for label in labelIds)
            ]

        # Apply pagination
        start_idx = int(pageToken) if pageToken else 0
        end_idx = start_idx + maxResults
        page_messages = filtered_messages[start_idx:end_idx]

        result = {
            "messages": [
                {"id": msg["id"], "threadId": msg["threadId"]}
                for msg in page_messages
            ],
            "resultSizeEstimate": len(filtered_messages)
        }

        if end_idx < len(filtered_messages):
            result["nextPageToken"] = str(end_idx)

        return result

    def users_messages_get(
        self,
        userId: str = "me",
        id: str = None,
        format: str = "full"
    ) -> Dict:
        """Mock messages.get() API call"""
        message = next((msg for msg in self.messages if msg["id"] == id), None)

        if not message:
            raise ValueError(f"Message not found: {id}")

        if format == "minimal":
            return {
                "id": message["id"],
                "threadId": message["threadId"]
            }
        elif format == "metadata":
            return {
                "id": message["id"],
                "threadId": message["threadId"],
                "labelIds": message["labelIds"],
                "payload": {
                    "headers": message["payload"]["headers"]
                }
            }
        else:  # full
            return message

    def users_messages_modify(
        self,
        userId: str = "me",
        id: str = None,
        body: Dict = None
    ) -> Dict:
        """Mock messages.modify() API call"""
        message = next((msg for msg in self.messages if msg["id"] == id), None)

        if not message:
            raise ValueError(f"Message not found: {id}")

        # Apply label modifications
        if "addLabelIds" in body:
            for label in body["addLabelIds"]:
                if label not in message["labelIds"]:
                    message["labelIds"].append(label)

        if "removeLabelIds" in body:
            for label in body["removeLabelIds"]:
                if label in message["labelIds"]:
                    message["labelIds"].remove(label)

        return message

    def users_messages_send(
        self,
        userId: str = "me",
        body: Dict = None
    ) -> Dict:
        """Mock messages.send() API call"""
        # Decode the RFC 2822 formatted message
        raw_message = base64.urlsafe_b64decode(body["raw"]).decode()

        # Simple parsing (in reality would use email.parser)
        lines = raw_message.split("\n")
        headers = {}
        body_start = 0

        for i, line in enumerate(lines):
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip()] = value.strip()
            elif line == "":
                body_start = i + 1
                break

        msg_body = "\n".join(lines[body_start:])

        sent_msg = {
            "id": f"sent_{len(self.sent_messages) + 1:05d}",
            "threadId": f"thread_sent_{len(self.sent_messages) + 1:05d}",
            "labelIds": ["SENT"],
            "headers": headers,
            "body": msg_body
        }

        self.sent_messages.append(sent_msg)
        return {"id": sent_msg["id"], "threadId": sent_msg["threadId"]}

    def users_labels_list(self, userId: str = "me") -> Dict:
        """Mock labels.list() API call"""
        return {"labels": self.labels}

    def users_threads_list(
        self,
        userId: str = "me",
        q: str = None,
        labelIds: List[str] = None,
        maxResults: int = 100
    ) -> Dict:
        """Mock threads.list() API call"""
        # Group messages by thread
        threads = {}
        for msg in self.messages:
            thread_id = msg["threadId"]
            if thread_id not in threads:
                threads[thread_id] = []
            threads[thread_id].append(msg)

        # Apply filters
        filtered_threads = []
        for thread_id, messages in threads.items():
            if q and not any(self._matches_query(msg, q) for msg in messages):
                continue
            if labelIds and not any(
                any(label in msg["labelIds"] for label in labelIds)
                for msg in messages
            ):
                continue

            filtered_threads.append({
                "id": thread_id,
                "snippet": messages[-1]["snippet"],
                "historyId": f"hist_{thread_id}"
            })

        return {
            "threads": filtered_threads[:maxResults],
            "resultSizeEstimate": len(filtered_threads)
        }

    def _matches_query(self, message: Dict, query: str) -> bool:
        """Check if message matches search query"""
        query_lower = query.lower()

        # Search in subject
        subject = next(
            (h["value"] for h in message["payload"]["headers"] if h["name"] == "Subject"),
            ""
        )
        if query_lower in subject.lower():
            return True

        # Search in snippet
        if query_lower in message["snippet"].lower():
            return True

        # Search in body
        if "data" in message["payload"]["body"]:
            body = base64.urlsafe_b64decode(
                message["payload"]["body"]["data"]
            ).decode()
            if query_lower in body.lower():
                return True

        return False

    def clear_all(self):
        """Clear all mock data"""
        self.messages = []
        self.sent_messages = []


def create_mock_gmail_service():
    """Factory function to create mock Gmail API service"""
    mock_api = MockGmailAPI()

    # Create mock service structure similar to Google API
    class MockService:
        def __init__(self, api):
            self.api = api

        def users(self):
            return MockUsers(self.api)

    class MockUsers:
        def __init__(self, api):
            self.api = api

        def messages(self):
            return MockMessages(self.api)

        def labels(self):
            return MockLabels(self.api)

        def threads(self):
            return MockThreads(self.api)

    class MockMessages:
        def __init__(self, api):
            self.api = api

        def list(self, **kwargs):
            return MockRequest(self.api.users_messages_list, kwargs)

        def get(self, **kwargs):
            return MockRequest(self.api.users_messages_get, kwargs)

        def modify(self, **kwargs):
            return MockRequest(self.api.users_messages_modify, kwargs)

        def send(self, **kwargs):
            return MockRequest(self.api.users_messages_send, kwargs)

    class MockLabels:
        def __init__(self, api):
            self.api = api

        def list(self, **kwargs):
            return MockRequest(self.api.users_labels_list, kwargs)

    class MockThreads:
        def __init__(self, api):
            self.api = api

        def list(self, **kwargs):
            return MockRequest(self.api.users_threads_list, kwargs)

    class MockRequest:
        def __init__(self, func, kwargs):
            self.func = func
            self.kwargs = kwargs

        def execute(self):
            return self.func(**self.kwargs)

    return MockService(mock_api), mock_api
