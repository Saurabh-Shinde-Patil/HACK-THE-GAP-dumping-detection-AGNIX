// Notification service – abstracted for multiple channels
// Plug in FCM, Twilio, SendGrid credentials in .env when deploying

const sendNotification = async ({ type, to, title, body, data = {} }) => {
  // Log all notifications in development
  console.log(`📢 NOTIFICATION [${type}] → ${to}: "${title}" - ${body}`);

  // TODO: Integrate FCM for push
  // if (type === 'push' && data.fcmToken) { ... }

  // TODO: Integrate Twilio for SMS
  // if (type === 'sms') { ... }

  // TODO: Integrate SendGrid for email
  // if (type === 'email') { ... }
};

const notifyWorkerNewTask = async (worker, task) => {
  await sendNotification({
    type: 'push',
    to: worker.email,
    title: '🗑️ New Cleanup Task',
    body: `You have been assigned a new cleanup task. Priority: ${task.priority}`,
    data: { taskId: task._id.toString(), type: 'task_assigned' },
  });
};

const notifyAdminNewReport = async (admin, report) => {
  await sendNotification({
    type: 'push',
    to: admin.email,
    title: '🚨 New Garbage Alert',
    body: `Garbage detected at ${report.address}. Severity: ${report.severity}`,
    data: { reportId: report._id.toString(), type: 'new_report' },
  });
};

module.exports = { sendNotification, notifyWorkerNewTask, notifyAdminNewReport };
