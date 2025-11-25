import { execFile } from 'child_process';

export function sendIMessage(to: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "${to}" of targetService
        send "${escapeQuotes(body)}" to targetBuddy
      end tell
    `;
    execFile('osascript', ['-e', script], (err, stdout, stderr) => {
      if (err) return reject(err);
      if (stderr) return reject(new Error(stderr));
      resolve();
    });
  });
}

function escapeQuotes(text: string): string {
  return text.replace(/"/g, '\\"');
}
