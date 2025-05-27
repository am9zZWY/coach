export interface Mail {
  from: string;
  subject: string;
  message: string;
  id: string;
  receivedAt: number;
  read?: boolean;
}
