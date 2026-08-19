

import { apiRoutes } from '@/app/api_routes';

/**
 * Persisted feedback record displayed by the development feedback table.
 *
 * @example
 * ```ts
 * const report: FeedbackT = {
 *   id: 17,
 *   name: "Public health analyst",
 *   email: "analyst@example.org",
 *   feedback_type: 2,
 *   message: "The uncertainty tooltip needs a keyboard-accessible trigger.",
 *   created_at: "2026-08-12T14:30:00Z",
 * };
 * ```
 */
export type FeedbackT = {
  /** Database primary key. */
  id: number;
  /** Submitted display name. */
  name: string;
  /** Submitted contact address. */
  email: string;
  /** Numeric feedback-category identifier. */
  feedback_type: number;
  /** Feedback body. */
  message: string;
  /** ISO-compatible creation timestamp. */
  created_at: string;
};

/** DataTable adapter for persisted feedback records. */
class FeedbackTable {
  id: number;
  name: string;
  email: string;
  feedback_type: number;
  message: string;
  created_at: string;

  private readonly _url: string = apiRoutes.fetchDbData({ relationName: "feedback_csv", feature: "ALL" });
  private readonly _dataName: string = "feedback_csv";


  constructor() {
    this.id = 0;
    this.name = "";
    this.email = "";
    this.feedback_type = 0;
    this.message = "";
    this.created_at = "";
  }

  getURL(): string {
    return this._url;
  }

  getTableName(): string {
    return this._dataName;
  }

};






/** Default export for the feedback table adapter. */
export default FeedbackTable;
