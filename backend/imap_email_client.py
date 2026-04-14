"""
IMAP Email Client — Fetch and sync emails from iCloud, Yahoo, Gmail, Outlook
and custom IMAP servers into the BIQc outlook_emails table.
"""
import imaplib
import email
from email.header import decode_header
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# ─── Known IMAP Server Configurations ────────────────────────────────────────

IMAP_SERVERS = {
    "icloud": {"host": "imap.mail.me.com", "port": 993, "ssl": True},
    "yahoo": {"host": "imap.mail.yahoo.com", "port": 993, "ssl": True},
    "gmail_imap": {"host": "imap.gmail.com", "port": 993, "ssl": True},
    "outlook_imap": {"host": "outlook.office365.com", "port": 993, "ssl": True},
}


class IMAPEmailClient:
    """Connect to an IMAP server and fetch email messages."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        use_ssl: bool = True,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self._connection: Optional[imaplib.IMAP4] = None

    # ── Connection lifecycle ─────────────────────────────────────────────

    def connect(self) -> bool:
        """Establish an IMAP connection and authenticate. Returns True on success."""
        try:
            if self.use_ssl:
                self._connection = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                self._connection = imaplib.IMAP4(self.host, self.port)

            self._connection.login(self.username, self.password)
            logger.info("[IMAP] Connected to %s as %s", self.host, self.username)
            return True
        except imaplib.IMAP4.error as e:
            logger.error("[IMAP] Authentication failed for %s@%s: %s", self.username, self.host, e)
            self._connection = None
            return False
        except Exception as e:
            logger.error("[IMAP] Connection failed to %s:%s — %s", self.host, self.port, e)
            self._connection = None
            return False

    def disconnect(self):
        """Safely close the IMAP connection."""
        if self._connection is None:
            return
        try:
            self._connection.logout()
            logger.info("[IMAP] Disconnected from %s", self.host)
        except Exception as e:
            logger.warning("[IMAP] Error during logout from %s: %s", self.host, e)
        finally:
            self._connection = None

    # ── Email fetching ───────────────────────────────────────────────────

    def fetch_recent_emails(
        self,
        folder: str = "INBOX",
        days: int = 3,
        max_count: int = 50,
    ) -> List[Dict]:
        """
        Fetch recent emails from the specified folder.

        Returns a list of dicts with keys:
            message_id, subject, sender_email, sender_name, to_email,
            body_preview, received_at, folder, is_read
        """
        if self._connection is None:
            logger.error("[IMAP] Not connected — call connect() first")
            return []

        try:
            status, _ = self._connection.select(folder, readonly=True)
            if status != "OK":
                logger.warning("[IMAP] Could not select folder %s", folder)
                return []
        except Exception as e:
            logger.error("[IMAP] Error selecting folder %s: %s", folder, e)
            return []

        since_date = (datetime.utcnow() - timedelta(days=days)).strftime("%d-%b-%Y")
        try:
            status, msg_ids = self._connection.search(None, f'SINCE {since_date}')
            if status != "OK" or not msg_ids[0]:
                return []
        except Exception as e:
            logger.error("[IMAP] Search failed in %s: %s", folder, e)
            return []

        id_list = msg_ids[0].split()
        # Take the most recent messages (last N in the list)
        id_list = id_list[-max_count:]

        emails: List[Dict] = []
        for msg_id in id_list:
            try:
                status, msg_data = self._connection.fetch(msg_id, "(RFC822 FLAGS)")
                if status != "OK" or not msg_data or not msg_data[0]:
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Parse flags for read status
                flags_raw = msg_data[0][0] if isinstance(msg_data[0], tuple) else b""
                is_read = b"\\Seen" in flags_raw

                # Parse headers
                subject = self._decode_header(msg.get("Subject", ""))
                from_header = self._decode_header(msg.get("From", ""))
                to_header = self._decode_header(msg.get("To", ""))
                date_header = msg.get("Date", "")
                message_id_header = msg.get("Message-ID", "")

                # Extract sender name and email
                sender_name = ""
                sender_email = from_header
                if "<" in from_header and ">" in from_header:
                    sender_name = from_header[:from_header.index("<")].strip().strip('"')
                    sender_email = from_header[from_header.index("<") + 1:from_header.index(">")].strip()

                # Parse received date
                received_at = None
                if date_header:
                    try:
                        parsed = email.utils.parsedate_to_datetime(date_header)
                        received_at = parsed.isoformat()
                    except Exception:
                        received_at = date_header

                # Extract body (prefer text/plain)
                body_preview = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/plain":
                            charset = part.get_content_charset() or "utf-8"
                            try:
                                body_preview = part.get_payload(decode=True).decode(charset, errors="replace")
                            except Exception:
                                body_preview = part.get_payload(decode=True).decode("utf-8", errors="replace")
                            break
                else:
                    content_type = msg.get_content_type()
                    if content_type == "text/plain":
                        charset = msg.get_content_charset() or "utf-8"
                        try:
                            body_preview = msg.get_payload(decode=True).decode(charset, errors="replace")
                        except Exception:
                            body_preview = msg.get_payload(decode=True).decode("utf-8", errors="replace")

                # Truncate body preview
                body_preview = body_preview.strip()[:1000]

                emails.append({
                    "message_id": message_id_header,
                    "subject": subject,
                    "sender_email": sender_email,
                    "sender_name": sender_name,
                    "to_email": to_header,
                    "body_preview": body_preview,
                    "received_at": received_at,
                    "folder": folder,
                    "is_read": is_read,
                })
            except Exception as e:
                logger.warning("[IMAP] Error parsing message %s: %s", msg_id, e)
                continue

        return emails

    # ── Header decoding ──────────────────────────────────────────────────

    @staticmethod
    def _decode_header(header_value: str) -> str:
        """Decode a MIME-encoded header value into a plain string."""
        if not header_value:
            return ""
        try:
            decoded_parts = decode_header(header_value)
            parts = []
            for part, charset in decoded_parts:
                if isinstance(part, bytes):
                    parts.append(part.decode(charset or "utf-8", errors="replace"))
                else:
                    parts.append(part)
            return " ".join(parts)
        except Exception:
            return str(header_value)


# ─── Standalone sync function ────────────────────────────────────────────────


def sync_imap_emails(user_id: str, sb_client, connection_config: dict) -> int:
    """
    Sync emails from an IMAP server to the outlook_emails table.

    Args:
        user_id: The BIQc user ID.
        sb_client: An initialised Supabase client (sync).
        connection_config: Dict with keys: host, port, username, password,
                           use_ssl (bool), provider (str), folder (optional),
                           days (optional), max_count (optional).

    Returns:
        Number of emails successfully synced.
    """
    # Resolve IMAP server settings — allow named presets or custom host
    provider = connection_config.get("provider", "custom")
    preset = IMAP_SERVERS.get(provider)

    host = connection_config.get("host") or (preset or {}).get("host")
    port = connection_config.get("port") or (preset or {}).get("port", 993)
    use_ssl = connection_config.get("use_ssl", (preset or {}).get("ssl", True))
    username = connection_config["username"]
    password = connection_config["password"]

    if not host:
        logger.error("[IMAP Sync] No host resolved for provider '%s'", provider)
        return 0

    folder = connection_config.get("folder", "INBOX")
    days = connection_config.get("days", 3)
    max_count = connection_config.get("max_count", 50)

    client = IMAPEmailClient(host, port, username, password, use_ssl)

    if not client.connect():
        logger.error("[IMAP Sync] Could not connect for user %s via %s", user_id, provider)
        return 0

    synced = 0
    try:
        emails = client.fetch_recent_emails(folder=folder, days=days, max_count=max_count)
        logger.info("[IMAP Sync] Fetched %d emails for user %s from %s", len(emails), user_id, provider)

        for em in emails:
            try:
                row = {
                    "user_id": user_id,
                    "message_id": em["message_id"],
                    "subject": em["subject"],
                    "from_name": em["sender_name"],
                    "from_address": em["sender_email"],
                    "to_recipients": em["to_email"],
                    "body_preview": em["body_preview"],
                    "received_date": em["received_at"],
                    "folder": em["folder"],
                    "is_read": em["is_read"],
                    "provider": provider,
                }
                sb_client.table("outlook_emails") \
                    .upsert(row, on_conflict="user_id,message_id") \
                    .execute()
                synced += 1
            except Exception as e:
                logger.warning(
                    "[IMAP Sync] Failed to upsert email %s for user %s: %s",
                    em.get("message_id", "?"), user_id, e,
                )
    finally:
        client.disconnect()

    logger.info("[IMAP Sync] Synced %d emails for user %s via %s", synced, user_id, provider)
    return synced
