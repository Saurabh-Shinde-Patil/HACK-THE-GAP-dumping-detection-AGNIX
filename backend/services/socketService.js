let io;

const init = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a room by role or ward
    socket.on('join-room', (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};

// Broadcast new alert to all admins
const emitNewAlert = (report) => {
  if (io) {
    io.to('admins').emit('new-alert', report);
    io.to('superadmins').emit('new-alert', report);
    io.emit('alert-update', { type: 'new', report });
  }
};

// Notify specific worker of task assignment
const emitTaskAssigned = (workerId, task) => {
  if (io) {
    io.to(`worker-${workerId}`).emit('task-assigned', task);
    io.to('admins').emit('task-update', { type: 'assigned', task });
  }
};

// Broadcast task completion
const emitTaskCompleted = (task) => {
  if (io) {
    io.to('admins').emit('task-completed', task);
    io.to('superadmins').emit('task-completed', task);
  }
};

const getIO = () => io;

module.exports = { init, emitNewAlert, emitTaskAssigned, emitTaskCompleted, getIO };
