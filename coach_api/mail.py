import email
import hashlib
import imaplib
import uuid
from email.header import decode_header
from typing import List, Dict, Optional


def get_mails(
        username: str,
        password: str,
        imap_server: str,
        imap_port: int,
        mailbox: str = "INBOX",
        limit: Optional[int] = None,
        only_unread: bool = False
) -> List[Dict[str, str]]:
    """Enhanced email retrieval using built-in body extraction methods."""
    emails = []

    try:
        imap = imaplib.IMAP4_SSL(imap_server, imap_port)
        imap.login(username, password)
        imap.select(mailbox)

        search_criteria = '(UNSEEN)' if only_unread else 'ALL'
        status, messages = imap.search(None, search_criteria)
        email_ids = messages[0].split()

        if limit:
            email_ids = email_ids[-limit:]

        for email_id in email_ids:
            status, msg_data = imap.fetch(email_id, '(BODY.PEEK[] FLAGS)')

            # Extract flags to determine read status
            flags_response = msg_data[0]
            flags = flags_response[0].decode() if isinstance(flags_response[0], bytes) else str(flags_response[0])
            is_read = '\\Seen' in flags

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    # Parse mail
                    msg = email.message_from_bytes(response_part[1])

                    # Extract headers
                    date = _decode_header_value(msg.get('Date', ''))
                    mail_from = _decode_header_value(msg.get('From', ''))
                    mail_to = _decode_header_value(msg.get('To', ''))
                    subject = _decode_header_value(msg.get('Subject', ''))

                    # Extract body
                    body = _extract_body(msg)

                    # Generate id based on date, sender and subject
                    namespace = uuid.NAMESPACE_DNS
                    unique_string = f"{date}{mail_from}{subject}"
                    mail_id = str(uuid.uuid5(namespace, unique_string))[:12]

                    emails.append({
                        "id": mail_id,
                        "date": date,
                        "from": mail_from,
                        "to": mail_to,
                        "subject": subject,
                        "body": body,
                        "read": is_read
                    })

        imap.close()
        imap.logout()

    except Exception as e:
        raise Exception(f"Failed to retrieve emails: {str(e)}")

    return emails


def _decode_header_value(header_value: str) -> str:
    """Decode email header value."""
    if not header_value:
        return ""

    decoded_parts = decode_header(header_value)
    decoded_string = ""

    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            decoded_string += part.decode(encoding or 'utf-8')
        else:
            decoded_string += part

    return decoded_string


def _extract_body(msg) -> str:
    """Enhanced body extraction using built-in email methods."""
    # Try modern get_body() method first
    if hasattr(msg, 'get_body'):
        body_part = msg.get_body(preferencelist=('plain', 'html'))
        if body_part:
            try:
                return body_part.get_content().strip()
            except:
                pass

    # Fallback to traditional method
    return _extract_body_fallback(msg)


def _extract_body_fallback(msg) -> str:
    """Traditional body extraction method."""
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                continue

            if content_type == "text/plain":
                try:
                    body = part.get_payload(decode=True).decode('utf-8')
                    break
                except:
                    continue
    else:
        if msg.get_content_type() == "text/plain":
            try:
                body = msg.get_payload(decode=True).decode('utf-8')
            except:
                body = str(msg.get_payload())

    return body.strip()
