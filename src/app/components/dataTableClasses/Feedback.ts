

import { apiRoutes } from "../../api_routes";

export type FeedbackT = {
  id: number;
  name: string;
  email: string;
  feedback_type: number;
  message: string;
  created_at: string;
};

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

  getStateID(rowJSON: any): number {
    let row = JSON.parse(JSON.stringify(rowJSON));
    return row.original.idbundesland;
  }

  public static getStateBundesland(rowJSON: any): string {
    let row = JSON.parse(JSON.stringify(rowJSON));
    return row.original.bundesland;
  }
};






export default FeedbackTable;