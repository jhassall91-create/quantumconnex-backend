// ─────────────────────────────────────────────────────────────────
// FILE 1: socket-middleware.js
// JWT authentication middleware for Socket.IO
// Attach to your io instance BEFORE any event handlers
// ─────────────────────────────────────────────────────────────────

const jwt = require("jsonwebtoken");

/**
 * Usage in your main index.js:
 *
 *   const { applySocketAuth } = require("./socket-middleware");
 *   applySocketAuth(io);
 *   // then register your event handlers
 */

function applySocketAuth(io) {
    io.use((socket, next) => {
        // Accept token from handshake auth or query string
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.query?.token;

        if (!token) {
            return next(new Error("AUTH_MISSING: no token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user context to socket — available everywhere after this
            socket.user = {
                userId: decoded.id,
                email: decoded.email ?? null,
            };

            next();
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return next(new Error("AUTH_EXPIRED: token has expired"));
            }
            return next(new Error("AUTH_INVALID: token verification failed"));
        }
    });
}

module.exports = { applySocketAuth };
