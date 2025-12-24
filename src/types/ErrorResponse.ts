export type ErrorResponse = {
  code: string;
  message: string;
  hint?: string;
  docs_url?: string;
  request_id: string;
};
