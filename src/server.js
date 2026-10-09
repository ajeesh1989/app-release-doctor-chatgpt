import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { z } from "zod";

const PORT =
  Number(process.env.PORT || 8788);

const REMOTE_MCP_URL =
  "https://app-release-doctor-mcp.onrender.com/mcp";

const UI_URI =
  "ui://widget/app-release-doctor.html";

const uiHtml = readFileSync(
  new URL(
    "../dist/index.html",
    import.meta.url,
  ),
  "utf8",
);

/*
 * Local ChatGPT / Inspector sessions.
 */
const sessions = new Map();

/*
 * Persistent connection to the production
 * App Release Doctor MCP server.
 */
let remoteClient = null;
let remoteTransport = null;
let remoteConnectionPromise = null;

/*
 * Create a fresh connection to the
 * production MCP server.
 */
async function getRemoteClient() {
  if (remoteClient) {
    return remoteClient;
  }

  if (remoteConnectionPromise) {
    return remoteConnectionPromise;
  }

  remoteConnectionPromise =
    (async () => {
      const client =
        new Client({
          name:
            "app-release-doctor-chatgpt",
          version: "1.0.0",
        });

      const transport =
        new StreamableHTTPClientTransport(
          new URL(
            REMOTE_MCP_URL,
          ),
        );

      try {
        await client.connect(
          transport,
        );

        remoteClient =
          client;

        remoteTransport =
          transport;

        console.log(
          "Connected to production App Release Doctor MCP",
        );

        return client;
      } catch (error) {
        try {
          await transport.close();
        } catch {
          // Ignore cleanup errors.
        }

        throw error;
      } finally {
        remoteConnectionPromise =
          null;
      }
    })();

  return remoteConnectionPromise;
}

/*
 * Close and completely reset the
 * cached production MCP connection.
 */
async function resetRemoteConnection() {
  const client =
    remoteClient;

  const transport =
    remoteTransport;

  remoteClient = null;
  remoteTransport = null;

  if (transport) {
    try {
      await transport.close();
    } catch {
      // Ignore cleanup errors.
    }
  }

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore cleanup errors.
    }
  }

  console.log(
    "Production MCP connection reset.",
  );
}

/*
 * Determine whether an error means the
 * remote Streamable HTTP MCP session is
 * no longer valid.
 */
function isRemoteSessionError(
  error,
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes(
      "MCP session not found or expired",
    ) ||
    message.includes(
      "session not found",
    ) ||
    message.includes(
      "session expired",
    )
  );
}

/*
 * Call a production MCP tool.
 *
 * If the cached MCP session has expired,
 * reconnect once and retry the tool.
 */
async function callRemoteTool(
  name,
  args = {},
) {
  let client =
    await getRemoteClient();

  try {
    return await client.callTool({
      name,
      arguments: args,
    });
  } catch (error) {
    if (
      !isRemoteSessionError(
        error,
      )
    ) {
      throw error;
    }

    console.warn(
      "Production MCP session expired. Reconnecting and retrying once...",
    );

    await resetRemoteConnection();

    client =
      await getRemoteClient();

    return await client.callTool({
      name,
      arguments: args,
    });
  }
}

/*
 * Create a local MCP server for each
 * ChatGPT / Inspector session.
 */
function createMcpServer() {
  const server =
    new McpServer({
      name:
        "App Release Doctor",
      version: "1.0.0",
    });

  /*
   * Register the ChatGPT App UI resource.
   */
  registerAppResource(
    server,
    "app-release-doctor",
    UI_URI,
    {},
    async () => {
      return {
        contents: [
          {
            uri: UI_URI,
            mimeType:
              RESOURCE_MIME_TYPE,
            text: uiHtml,
          },
        ],
      };
    },
  );

  /*
   * Register the single ChatGPT App tool.
   */
  registerAppTool(
    server,
    "app_release_doctor",
    {
      title:
        "App Release Doctor",

      description:
        "Open App Release Doctor to inspect Flutter Android releases and check Google Play readiness. To inspect an attached Android App Bundle, provide its file metadata; it will be uploaded before inspection.",

      inputSchema:
        z.object({
          action: z
            .enum([
              "inspect_aab",
              "check_flutter_project",
              "check_target_sdk",
              "check_play_store_readiness",
            ])
            .optional(),

          /*
           * Local Flutter project path.
           */
          projectPath: z
            .string()
            .optional(),

          /*
           * Remote Flutter project upload ID.
           */
          uploadId: z
            .string()
            .optional(),

          /*
           * Local AAB path.
           */
          aabPath: z
            .string()
            .optional(),

          file: z
            .object({
              download_url: z
                .string()
                .url(),
              file_id: z
                .string()
                .min(1),
              mime_type: z
                .string()
                .optional(),
              file_name: z
                .string()
                .optional(),
            })
            .optional(),
        }),
      
      _meta: {
        "ui/resourceUri":
          UI_URI,

        "openai/outputTemplate":
          UI_URI,

        "openai/fileParams": [
          "file",
        ],

        "openai/toolInvocation/invoking":
          "Opening App Release Doctor...",

        "openai/toolInvocation/invoked":
          "App Release Doctor is ready.",
      },
    },

    async ({
      action,
      projectPath,
      uploadId,
      aabPath,
      file,
    }) => {
      const diagnosticAction =
        action ??
        (file ? "inspect_aab" : undefined);

      /*
       * If ChatGPT opens the App without
       * selecting a diagnostic, simply return
       * the ready message.
       */
      if (!diagnosticAction) {
        return {
          content: [
            {
              type: "text",
              text:
                "App Release Doctor is ready.",
            },
          ],
        };
      }

      try {
        console.log(
          `Calling production tool: ${diagnosticAction}`,
        );

        /*
         * Build the arguments that will be sent
         * to the production App Release Doctor MCP.
         */
        let remoteArgs = {};

        /*
         * Target SDK check requires targetSdk.
         */
        if (
          diagnosticAction ===
          "check_target_sdk"
        ) {
          remoteArgs = {
            targetSdk: 36,
          };
        }

        /*
         * Flutter project diagnostics can use
         * either a local project path or a
         * remotely uploaded workspace.
         */
        if (
          diagnosticAction ===
            "check_flutter_project" ||
          diagnosticAction ===
            "check_play_store_readiness"
        ) {
          if (projectPath) {
            remoteArgs.projectPath =
              projectPath;
          }

          if (uploadId) {
            remoteArgs.uploadId =
              uploadId;
          }
        }

        /*
         * AAB inspection can use either a local
         * AAB path or a remotely uploaded AAB.
         */
        if (
          diagnosticAction ===
          "inspect_aab"
        ) {
          if (file) {
            const uploadResult =
              await callRemoteTool(
                "upload_aab",
                { file },
              );

            if (uploadResult.isError) {
              const details =
                uploadResult.content
                  ?.filter(
                    (item) =>
                      item.type === "text",
                  )
                  .map((item) => item.text)
                  .join("\n");

              throw new Error(
                `Production upload_aab failed: ${
                  details || "No error details returned."
                }`,
              );
            }

            const structuredUploadId =
              uploadResult.structuredContent
                ?.uploadId;
            const textUploadId =
              uploadResult.content
                ?.filter(
                  (item) =>
                    item.type === "text",
                )
                .map((item) =>
                  item.text.match(
                    /"uploadId"\s*:\s*"([^"]+)"|uploadId\s*[:=]\s*([^\s,}]+)/i,
                  ),
                )
                .find(Boolean);
            const uploadedId =
              typeof structuredUploadId === "string"
                ? structuredUploadId
                : textUploadId?.[1] ??
                  textUploadId?.[2];

            if (!uploadedId) {
              throw new Error(
                "Production upload_aab response did not include an uploadId.",
              );
            }

            remoteArgs.uploadId =
              uploadedId;
          } else {
            if (aabPath) {
              remoteArgs.aabPath =
                aabPath;
            }

            if (uploadId) {
              remoteArgs.uploadId =
                uploadId;
            }
          }
        }

        console.log(
          "Production tool arguments:",
          remoteArgs,
        );

        const remoteResult =
          await callRemoteTool(
            diagnosticAction,
            remoteArgs,
          );

        return remoteResult;
      } catch (error) {
        console.error(
          `Remote tool "${diagnosticAction}" failed:`,
          error,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `Unable to run ${diagnosticAction.replaceAll(
                  "_",
                  " ",
                )} on the production App Release Doctor MCP.\n\n` +
                `Error: ${
                  error instanceof Error
                    ? error.message
                    : String(error)
                }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

/*
 * Local HTTP server.
 */
const httpServer =
  createServer(
    async (req, res) => {
      try {
        /*
         * Direct UI test.
         */
        if (
          req.method === "GET" &&
          req.url === "/ui-test"
        ) {
          res.writeHead(200, {
            "Content-Type":
              "text/html; charset=utf-8",
          });

          res.end(uiHtml);
          return;
        }

        /*
         * Health endpoint.
         */
        if (
          req.method === "GET" &&
          req.url === "/health"
        ) {
          res.writeHead(200, {
            "Content-Type":
              "application/json",
          });

          res.end(
            JSON.stringify({
              ok: true,
              service:
                "app-release-doctor-chatgpt",
              transport:
                "streamable-http",
              endpoint: "/mcp",
              remoteMcp:
                REMOTE_MCP_URL,
              remoteConnection:
                remoteClient
                  ? "connected"
                  : "not-connected",
            }),
          );

          return;
        }

        /*
         * Everything other than /mcp is not found.
         */
        if (req.url !== "/mcp") {
          res.writeHead(404, {
            "Content-Type":
              "application/json",
          });

          res.end(
            JSON.stringify({
              error:
                "Not found",
            }),
          );

          return;
        }

        /*
         * Find an existing MCP session.
         */
        const sessionId =
          req.headers[
            "mcp-session-id"
          ];

        let session =
          null;

        if (
          typeof sessionId ===
            "string" &&
          sessions.has(
            sessionId,
          )
        ) {
          session =
            sessions.get(
              sessionId,
            );
        }

        /*
         * Create a new local MCP session.
         */
        if (!session) {
          const server =
            createMcpServer();

          let transport;

          transport =
            new StreamableHTTPServerTransport(
              {
                sessionIdGenerator:
                  () =>
                    randomUUID(),

                onsessioninitialized:
                  (
                    newSessionId,
                  ) => {
                    sessions.set(
                      newSessionId,
                      {
                        server,
                        transport,
                      },
                    );
                  },
              },
            );

          transport.onclose =
            async () => {
              const currentSessionId =
                transport.sessionId;

              if (
                currentSessionId
              ) {
                sessions.delete(
                  currentSessionId,
                );
              }

              try {
                await server.close();
              } catch {
                // Already closed.
              }
            };

          await server.connect(
            transport,
          );

          session = {
            server,
            transport,
          };
        }

        /*
         * Handle the MCP request.
         */
        await session.transport.handleRequest(
          req,
          res,
        );
      } catch (error) {
        console.error(
          "MCP request error:",
          error,
        );

        if (
          !res.headersSent
        ) {
          res.writeHead(500, {
            "Content-Type":
              "application/json",
          });

          res.end(
            JSON.stringify({
              error:
                "Internal MCP server error",
            }),
          );
        }
      }
    },
  );

/*
 * Start server.
 */
httpServer.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `App Release Doctor ChatGPT App running on port ${PORT}`,
    );

    console.log(
      `MCP endpoint: http://localhost:${PORT}/mcp`,
    );

    console.log(
      `Health: http://localhost:${PORT}/health`,
    );

    console.log(
      `Remote MCP: ${REMOTE_MCP_URL}`,
    );
  },
);