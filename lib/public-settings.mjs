export function publicSettings(settings={}) {
 const privateKeys=new Set(['practiceWorkflowRules','practiceRemindersEnabled','bookingTeam','bookingCalendarId','notificationEmail','contentApprovalRequired']);
 return Object.fromEntries(Object.entries(settings).filter(([key])=>!privateKeys.has(key)));
}
