import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { api, apiUrl, money } from "../src/lib/api";
import { getPdfPreviewPath } from "../src/lib/pdf";
import { buildProjectTree } from "../src/lib/projectTree";
import AdminPage from "../src/app/page";

Object.assign(globalThis, { React });
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("admin API client includes cookies and returns successful data", async () => {
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(JSON.stringify({ success: true, message: "ok", data: { totalUsers: 3 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  assert.deepEqual(await api<{ totalUsers: number }>("/api/admin/dashboard"), {
    totalUsers: 3,
  });
  assert.equal(requestInit?.credentials, "include");
});

test("admin API client reports server and network errors", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: false, message: "Access denied" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(api("/api/admin/users"), /Access denied/);

  globalThis.fetch = async () => {
    throw new TypeError("network offline");
  };
  await assert.rejects(api("/api/admin/users"), /backend is running/);
});

test("admin INR formatting returns a localized currency value", () => {
  assert.match(money(1250), /₹/);
  assert.match(money(1250), /1,250/);
});

test("PDF preview uses the authenticated admin streaming endpoint", () => {
  assert.equal(
    getPdfPreviewPath("507f1f77bcf86cd799439011"),
    "/api/admin/software/507f1f77bcf86cd799439011/pdf",
  );
  assert.match(apiUrl(getPdfPreviewPath("507f1f77bcf86cd799439011")), /^http:\/\/localhost:5000\/api\/admin\/software\//);
});

test("admin project tree keeps nested folders, sorts folders first, and ignores unsafe paths", () => {
  const tree = buildProjectTree([
    "project/src/index.ts",
    "project/README.md",
    "project/assets/logo.svg",
    "project/src/",
    "../outside.txt",
    "/absolute.txt",
  ]);

  assert.deepEqual(tree.map((entry) => entry.name), ["project"]);
  assert.deepEqual(tree[0].children.map((entry) => entry.name), ["assets", "src", "README.md"]);
  assert.deepEqual(tree[0].children[1].children.map((entry) => entry.name), ["index.ts"]);
  assert.equal(tree[0].children[0].directory, true);
});

test("admin page renders an accessible initial loading state", () => {
  const markup = renderToStaticMarkup(createElement(AdminPage));
  assert.match(markup, /Loading administration\.\.\./);
  assert.match(markup, /class="admin-spinner"/);
});
