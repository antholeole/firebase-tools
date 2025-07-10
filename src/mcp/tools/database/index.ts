import type { ServerTool } from "../../tool";
import { get_data } from "./create_database";

export const realtimeDatabaseTools: ServerTool[] = [
  get_data
];
