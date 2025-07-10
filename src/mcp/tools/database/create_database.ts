import { z } from "zod";
import { tool } from "../../tool";
import { mcpError, toContent } from "../../util";
import * as url from "node:url";
import { Client } from "../../../apiv2";
import { getDatabaseUrl } from "../../../utils";
import {
	type DatabaseLocation,
	parseDatabaseLocation,
} from "../../../management/database";
import { FirebaseError, getErrMsg } from "../../../error";
import { DEFAULT_REGION } from "../../../frameworks/constants";
import { text } from "node:stream/consumers";

export const get_data = tool(
	{
		name: "get_data",
		description: "Returns RTDB data from the specified location",
		inputSchema: z.object({
			instance: z
				.string()
				.optional()
				.describe(
					"use the database <instance>, (if omitted, use default database instance <project>-default-rtdb)",
				),
			region: z
				.string()
				.optional()
				.describe(
					"which region the instance is located in. If omitted, defaults to us-central1 (<instance>.firebaseio.com)",
				),
			path: z.string().describe("The path to the data to read. (ex: /my/cool/path)"),
		}),
		annotations: {
			title: "Get Realtime Database data",
			readOnlyHint: true,
		},

		_meta: {
			// it's possible that a user attempts to query a database that they aren't
			// authed into: we should let the rules evaluate as the author intended.
			// If they have written rules to leave paths public, then having mcp
			// grab their data is perfectly valid.
			requiresAuth: false,
			requiresProject: false,
		},
	},
	async (
		{ path, region: maybeRegion, instance: maybeInstance },
		{ projectId },
	) => {
		if (!path.startsWith("/")) {
			return mcpError(`paths must start with '/' (you passed ''${path}')`);
		}

		let region: DatabaseLocation;
		try {
			region = parseDatabaseLocation(
				maybeRegion ?? "",
				DEFAULT_REGION as DatabaseLocation,
			);
		} catch (e) {
			if (e instanceof FirebaseError) {
				return mcpError(`error while parsing region: ${getErrMsg(e, e.name)}`);
			}

			throw e;
		}

		const instance = maybeInstance ?? `${projectId}-default-rtdb`;
		const dbHost = `${region}.firebasedatabase.app`;
		const dbUrl = getDatabaseUrl(dbHost, instance, `${path}.json`);

		const urlObj = new url.URL(dbUrl);
		const client = new Client({
			urlPrefix: urlObj.origin,
			auth: true,
		});

		const res = await client.request<unknown, NodeJS.ReadableStream>({
			method: "GET",
			path: urlObj.pathname,
			responseType: "stream",
			resolveOnHTTPError: true,
		});

		const content = await text(res.body);
		return toContent(content);
	},
);
