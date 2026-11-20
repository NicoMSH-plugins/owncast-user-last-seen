# User Last Seen (Owncast Plugin)

Displays in the Owncast admin panel when users and moderators were last online or sent a chat message.

![User Last Seen Admin Panel](screenshot.png)

## Features

- Tracks connected chat participants automatically every 30 seconds as well as sent chat messages
- Shows **Display Name**, **Last Online**, **Last Message**, **Messages** count, and **First Seen**
- Search filter by username and **Moderators only** filter
- **Hidden usernames** ignore list with wildcard support (e.g. `Guest*`) — moderators always remain visible
- Persistent storage across server restarts

## Installation

1. Download the latest `user-last-seen.ocpkg` from the [Releases](https://github.com/NicoMSH-plugins/owncast-user-last-seen/releases) page.
2. Place `user-last-seen.ocpkg` into your Owncast `data/plugins/` directory (or upload it via **Admin → Plugins**).
3. Restart Owncast if you copied the file manually, then enable **User Last Seen** under **Admin → Plugins**.

## Configuration

1. In your Owncast admin panel, go to **Integrations → Access Tokens** and create a new token with admin access.
2. Open **Admin → Plugins → User Last Seen → Configure** (Settings tab).
3. Paste the token into **`accessToken`** and verify **`owncastUrl`** (default: `http://127.0.0.1:8080`).
4. Save the settings and open **Last Seen** in the admin sidebar.

---

- **Author:** NicoMSH ([www.uaena.info](https://www.uaena.info))
- **Requires:** Owncast v0.3.0+
