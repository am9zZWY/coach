export interface MailType {
    // API
    id: string;
    date: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    read?: boolean;

    // Client
    summary?: string;
    reply?: string;
    labels: string[];
}
