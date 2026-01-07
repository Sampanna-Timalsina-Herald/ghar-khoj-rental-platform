import socketService from "../services/socket-service.js"

export const setupSocketEvents = (io, socket) => {
  const userId = socket.userId
  const userRole = socket.userRole

  console.log(`[SOCKET EVENTS] Setting up events for user ${userId}`)

  // Join user's personal room
  socket.join(`user-${userId}`)

  // Broadcast user online status
  io.emit("user-online", {
    userId,
    isOnline: true,
    timestamp: new Date(),
  })

  // ============ MESSAGE EVENTS ============

  // Send message - Socket only handles real-time delivery, not persistence
  // Messages are saved via REST API to prevent duplicates
  socket.on("send-message", async (data) => {
    try {
      const { receiverId, message, listingId, conversationId } = data

      console.log(`[SOCKET MESSAGE] ${userId} -> ${receiverId}: ${message} (for real-time only)`)

      // Notify receiver if online
      const receiverSocketId = socketService.getUserSocket(receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-notification", {
          sender_id: userId,
          conversation_id: conversationId,
          message: "New message received",
          timestamp: new Date(),
        })
      }
    } catch (error) {
      console.error("[SEND MESSAGE ERROR]", error)
      socket.emit("error", { message: "Failed to send message notification" })
    }
  })

  // Typing indicator
  socket.on("typing", (data) => {
    const { receiverId, conversationId } = data
    const receiverSocketId = socketService.getUserSocket(receiverId)

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-typing", {
        userId,
        conversationId,
      })
    }
  })

  // Stop typing
  socket.on("stop-typing", (data) => {
    const { receiverId, conversationId } = data
    const receiverSocketId = socketService.getUserSocket(receiverId)

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-stopped-typing", {
        userId,
        conversationId,
      })
    }
  })

  // Mark message as read
  socket.on("mark-read", async (data) => {
    try {
      const { messageId, conversationId, senderId } = data

      await socketService.markMessageAsRead(messageId, userId)

      // Notify sender
      const senderSocketId = socketService.getUserSocket(senderId)
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-read", {
          messageId,
          conversationId,
          readBy: userId,
          readAt: new Date(),
        })
      }

      console.log(`[READ] Message ${messageId} marked as read by ${userId}`)
    } catch (error) {
      console.error("[MARK READ ERROR]", error)
      socket.emit("error", { message: "Failed to mark message as read" })
    }
  })

  // ============ CONVERSATION EVENTS ============

  // Join conversation room
  socket.on("join-conversation", (data) => {
    const { conversationId } = data
    socket.join(`conversation-${conversationId}`)
    console.log(`[SOCKET] User ${userId} joined conversation ${conversationId}`)
  })

  // Leave conversation room
  socket.on("leave-conversation", (data) => {
    const { conversationId } = data
    socket.leave(`conversation-${conversationId}`)
    console.log(`[SOCKET] User ${userId} left conversation ${conversationId}`)
  })

  // ============ DISCONNECT EVENT ============

  socket.on("disconnect", async () => {
    await socketService.unregisterUserSocket(userId)

    // Broadcast user offline status
    io.emit("user-offline", {
      userId,
      isOnline: false,
      lastSeen: new Date(),
    })

    console.log(`[SOCKET] User ${userId} disconnected`)
  })
}
