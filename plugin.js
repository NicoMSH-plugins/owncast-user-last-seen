var { definePlugin, owncast } = require("@owncast/plugin-sdk");

var DATA_FILE = "last-seen-users.json";
var IGNORED_FILE = "ignored-names.json";
var CHECK_INTERVAL_MS = 30000;
var lastCheckAt = 0;

function readIgnoredNames() {
  try {
    if (!owncast.fs.exists(IGNORED_FILE)) {
      writeIgnoredNames([]);
      return [];
    }
    var raw = owncast.fs.readText(IGNORED_FILE);
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    owncast.log.error("Failed to read ignored-names.json: " + e.message);
    return [];
  }
}

function writeIgnoredNames(list) {
  try {
    var clean = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var val = String(list[i] || "").trim();
      var key = val.toLowerCase();
      if (val && !seen[key]) {
        seen[key] = true;
        clean.push(val);
      }
    }
    var res = owncast.fs.write(IGNORED_FILE, JSON.stringify(clean, null, 2));
    if (res && res.error) {
      owncast.log.error("Failed to write ignored-names.json: " + res.error);
    }
    return clean;
  } catch (e) {
    owncast.log.error("Exception while saving ignored-names.json: " + e.message);
    return list;
  }
}

function readUsers() {
  try {
    if (!owncast.fs.exists(DATA_FILE)) return {};
    var raw = owncast.fs.readText(DATA_FILE);
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    owncast.log.error("Failed to read last-seen-users.json: " + e.message);
    return {};
  }
}

function writeUsers(usersMap) {
  try {
    var res = owncast.fs.write(DATA_FILE, JSON.stringify(usersMap, null, 2));
    if (res && res.error) {
      owncast.log.error("Failed to write last-seen-users.json: " + res.error);
    }
  } catch (e) {
    owncast.log.error("Exception while saving last-seen-users.json: " + e.message);
  }
}

function upsertUser(usersMap, userObj, options) {
  if (!userObj || !userObj.id) return false;
  var nowIso = new Date().toISOString();
  var existing = usersMap[userObj.id] || {
    id: userObj.id,
    displayName: userObj.displayName || "Unknown",
    isModerator: false,
    isBot: false,
    authenticated: false,
    firstSeen: nowIso,
    lastSeen: nowIso,
    lastMessageAt: null,
    messageCount: 0
  };

  if (userObj.displayName) existing.displayName = userObj.displayName;
  if (Array.isArray(userObj.scopes) && userObj.scopes.indexOf("MODERATOR") !== -1) {
    existing.isModerator = true;
  }
  if (userObj.isBot === true) existing.isBot = true;
  if (userObj.authenticated === true) existing.authenticated = true;

  existing.lastSeen = nowIso;
  if (options && options.isMessage) {
    existing.lastMessageAt = nowIso;
    existing.messageCount = (existing.messageCount || 0) + 1;
  }

  usersMap[userObj.id] = existing;
  return true;
}

function pollConnectedClients() {
  var token = String(owncast.config.get("accessToken", "") || "").trim();
  if (!token) return;

  var baseUrl = String(owncast.config.get("owncastUrl", "http://127.0.0.1:8080") || "")
    .trim()
    .replace(/\/+$/, "");
  if (!baseUrl) baseUrl = "http://127.0.0.1:8080";

  try {
    var res = owncast.http.fetch(baseUrl + "/api/admin/chat/clients", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/json"
      }
    });
    if (!res || res.status !== 200 || !res.body) return;

    var clients = JSON.parse(res.body);
    if (!Array.isArray(clients) || clients.length === 0) return;

    var usersMap = readUsers();
    var changed = false;
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      var u = client && client.user ? client.user : client;
      if (u && u.id) {
        if (upsertUser(usersMap, u, { isMessage: false })) {
          changed = true;
        }
      }
    }
    if (changed) writeUsers(usersMap);
  } catch (e) {
    owncast.log.error("Poll /api/admin/chat/clients failed: " + e.message);
  }
}

function jsonResponse(status, data) {
  return {
    status: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  };
}

module.exports = definePlugin({
  onChatMessage(msg) {
    if (!msg || !msg.user) return;
    var usersMap = readUsers();
    if (upsertUser(usersMap, msg.user, { isMessage: true })) {
      writeUsers(usersMap);
    }
  },

  onTick(event) {
    var now = event && Number.isFinite(event.now) ? event.now : Date.now();
    if (now - lastCheckAt < CHECK_INTERVAL_MS) return;
    lastCheckAt = now;
    pollConnectedClients();
  },

  onHttpRequest(req) {
    if (!req.authenticated) {
      return jsonResponse(401, { error: "Admin authentication required." });
    }

    if (req.path === "/admin/api/users" && req.method === "GET") {
      pollConnectedClients();
      var usersMap = readUsers();
      var list = Object.keys(usersMap).map(function (id) {
        return usersMap[id];
      });
      list.sort(function (a, b) {
        return String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
      });
      var hasToken = Boolean(String(owncast.config.get("accessToken", "") || "").trim());
      return jsonResponse(200, {
        users: list,
        hasToken: hasToken,
        ignoredNames: readIgnoredNames()
      });
    }

    if (req.path === "/admin/api/users" && req.method === "DELETE") {
      var targetId = req.query && req.query.id ? String(req.query.id) : "";
      var usersMap = readUsers();
      if (targetId && usersMap[targetId]) {
        delete usersMap[targetId];
        writeUsers(usersMap);
      }
      return jsonResponse(200, { ok: true });
    }

    if (req.path === "/admin/api/ignored" && req.method === "PUT") {
      var body = JSON.parse(req.body || "{}");
      var saved = writeIgnoredNames(Array.isArray(body.ignoredNames) ? body.ignoredNames : []);
      return jsonResponse(200, { ignoredNames: saved });
    }

    return { status: 404 };
  }
});
