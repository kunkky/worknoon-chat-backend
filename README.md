# worknoon-chat-backend

Real-time chat backend for the Worknoon eCommerce platform. Supports authenticated multi-role users (admin, agent, customer, designer, merchant) with persistent conversations and Socket.IO-powered real-time messaging.

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js 20+                       |
| Framework   | Express 4                         |
| Database    | MongoDB + Mongoose                |
| Real-time   | Socket.IO 4                       |
| Auth        | JWT (jsonwebtoken + bcryptjs)     |
| Validation  | express-validator                 |

## Architecture

```
src/
├── config/         # MongoDB connection
├── controllers/    # Business logic (auth, users, conversations, messages)
├── middleware/     # JWT auth guard, role-based authorization
├── models/         # Mongoose schemas (User, Conversation, Message)
├── routes/         # Express routers
├── socket/         # Socket.IO event handlers
└── utils/          # JWT signing helper
server.js           # Entry point — HTTP server + Socket.IO init
```

### Data Model

- **User** — name, email, hashed password, role enum, isOnline, lastSeen
- **Conversation** — participants[], type (direct/group), lastMessage ref
- **Message** — conversation ref, sender ref, content, `readBy[]` (array supports multi-party read receipts)

The `readBy` array rather than a boolean flag is a deliberate decision: it correctly handles group conversations where different participants read at different times.

### Socket.IO Events

| Client → Server   | Purpose                            |
|-------------------|------------------------------------|
| `join_conversations` | Join all user's conversation rooms on connect |
| `send_message`    | Send a message (persists + broadcasts) |
| `typing_start`    | Broadcast typing indicator         |
| `typing_stop`     | Clear typing indicator             |
| `mark_read`       | Mark messages as read              |

| Server → Client   | Purpose                            |
|-------------------|------------------------------------|
| `new_message`     | Broadcast incoming message         |
| `typing`          | Forward typing indicator           |
| `stop_typing`     | Clear typing indicator             |
| `messages_read`   | Notify read status update          |
| `user_online`     | Presence update                    |
| `user_offline`    | Presence + lastSeen update         |

Socket auth uses JWT passed via `socket.handshake.auth.token` — verified in the Socket.IO middleware before any connection is established.

## Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### Install

```bash
git clone https://github.com/yourusername/worknoon-chat-backend
cd worknoon-chat-backend
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/worknoon-chat
JWT_SECRET=pick_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

### Run

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5000`.

## API Reference

### Auth

| Method | Path              | Auth | Description        |
|--------|-------------------|------|--------------------|
| POST   | `/api/auth/signup` | —    | Register new user  |
| POST   | `/api/auth/login`  | —    | Login, returns JWT |
| GET    | `/api/auth/me`     | JWT  | Get current user   |

### Conversations

| Method | Path                    | Auth | Description              |
|--------|-------------------------|------|--------------------------|
| GET    | `/api/conversations`    | JWT  | List user's conversations |
| POST   | `/api/conversations`    | JWT  | Create or reuse conversation |
| GET    | `/api/conversations/:id` | JWT | Get single conversation  |
| DELETE | `/api/conversations/:id` | JWT | Delete conversation      |

### Messages

| Method | Path                              | Auth | Description          |
|--------|-----------------------------------|------|----------------------|
| GET    | `/api/messages/:conversationId`   | JWT  | Get messages         |
| POST   | `/api/messages/:conversationId`   | JWT  | Send a message (REST) |
| PATCH  | `/api/messages/:conversationId/read` | JWT | Mark all as read  |
| DELETE | `/api/messages/:id`               | JWT  | Delete a message     |

### Users

| Method | Path                 | Auth       | Description          |
|--------|----------------------|------------|----------------------|
| GET    | `/api/users`         | JWT        | List all other users |
| GET    | `/api/users/:id`     | JWT        | Get user by ID       |
| PATCH  | `/api/users/me`      | JWT        | Update own profile   |
| GET    | `/api/users/admin/all` | JWT + admin | All users (admin)  |

## Tradeoffs & Intentional Deferrals

Given the assessment timeline, the following were intentionally deferred in favor of stabilizing the real-time messaging core:

- **File uploads** — would require multer + cloud storage (S3/Cloudinary). Architecture is ready for a `/api/uploads` route and a `fileUrl` field on Message.
- **Email/push notifications** — would require nodemailer + FCM/APNS. The socket's `user_offline` event provides the hook; a notification service would subscribe to it.
- **Redis pub/sub** — unnecessary for a single-server deployment. For horizontal scaling, Socket.IO adapters (`@socket.io/redis-adapter`) would be the addition.
- **Rate limiting** — `express-rate-limit` would be added before production.

## Challenges

- Socket.IO JWT auth required careful handling of the handshake vs. HTTP auth middleware distinction. The solution: separate `io.use()` middleware that runs before any `connection` event.
- Preventing duplicate direct conversations required a compound query on `participants` with `$all`. A database-level unique partial index would be the production hardening step.
